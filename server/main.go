package main

import (
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"gorm.io/datatypes"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

type Act struct {
	ID      uint           `json:"id" gorm:"primaryKey"`
	Name    string         `json:"name"`
	Type    string         `json:"type"`
	Folder  string         `json:"folder"`
	Comment string         `json:"comment"`
	Like    *int8          `json:"like"`
	Delete  *int8          `json:"delete"`
	GP      *int8          `json:"gp"`
	Nomad   *int8          `json:"nomad"`
	Book    *int8          `json:"book"`
	Rank    *int           `json:"rank"`
	Data    datatypes.JSON `json:"data" gorm:"type:longtext"`
}

type ActionRequest struct {
	Name   string                 `json:"name"`
	Action string                 `json:"action"`
	Data   map[string]interface{} `json:"data"`
}

var db *gorm.DB
var dir string
var thumbsDir string
var apiKey string
var photoshopApp string
var port string

func initConfig() {
	// Load .env if present (ignored if file doesn't exist)
	_ = godotenv.Load()

	dir = os.Getenv("ASSETS_DIR")
	if dir == "" {
		log.Fatal("ASSETS_DIR environment variable is required")
	}
	absDir, err := filepath.Abs(dir)
	if err != nil {
		log.Fatalf("Invalid ASSETS_DIR: %v", err)
	}
	dir = absDir

	thumbsDir = os.Getenv("THUMBS_DIR")
	if thumbsDir == "" {
		thumbsDir = filepath.Join(filepath.Dir(dir), "300")
	}
	absThumbsDir, err := filepath.Abs(thumbsDir)
	if err != nil {
		log.Fatalf("Invalid THUMBS_DIR: %v", err)
	}
	thumbsDir = absThumbsDir

	apiKey = os.Getenv("API_KEY")
	if apiKey == "" {
		log.Println("WARNING: API_KEY not set, authentication is disabled")
	}

	photoshopApp = os.Getenv("PHOTOSHOP_APP")
	if photoshopApp == "" {
		photoshopApp = "Adobe Photoshop 2025"
	}

	port = os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
}

func initDB() {
	dsn := os.Getenv("DB_DSN")
	if dsn == "" {
		log.Fatal("DB_DSN environment variable is required")
	}
	var err error
	db, err = gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Cannot connect to DB:", err)
	}
	if err := ensureActsDataColumn(); err != nil {
		log.Fatal("Cannot migrate DB schema:", err)
	}
}

func ensureActsDataColumn() error {
	var count int64
	check := db.Raw(`
		SELECT COUNT(*)
		FROM information_schema.COLUMNS
		WHERE TABLE_SCHEMA = DATABASE()
		  AND TABLE_NAME = 'acts'
		  AND COLUMN_NAME = 'data'
	`).Scan(&count)
	if check.Error != nil {
		return check.Error
	}

	if count > 0 {
		return nil
	}

	return db.Exec("ALTER TABLE `acts` ADD COLUMN `data` LONGTEXT NULL").Error
}

// FileInfo - структура для JSON-відповіді
type FileInfo struct {
	Name      string `json:"name"`
	IsDir     bool   `json:"isDir"`
	FileCount *int   `json:"fileCount,omitempty"` // Nil, якщо це файл
	GP        int64  `json:"gp,omitempty"`
	Nomad     int64  `json:"nomad,omitempty"`
	Like      int64  `json:"like,omitempty"`
	Book      int64  `json:"book,omitempty"`
}

func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if apiKey != "" && c.GetHeader("X-API-Key") != apiKey {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		c.Next()
	}
}

// validateItemPath validates a user-provided name and returns the safe absolute path
func validateItemPath(name string) (string, error) {
	if name == "" {
		return "", fmt.Errorf("empty name")
	}
	absPath, err := filepath.Abs(filepath.Join(dir, name))
	if err != nil {
		return "", fmt.Errorf("invalid path")
	}
	rel, err := filepath.Rel(dir, absPath)
	if err != nil || strings.HasPrefix(rel, "..") {
		return "", fmt.Errorf("path traversal detected")
	}
	return absPath, nil
}

func openItem(c *gin.Context) {
	name := c.Query("name")
	safePath, err := validateItemPath(name)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid path"})
		return
	}
	cmd := exec.Command("open", safePath)
	cmd.Start()
	c.JSON(http.StatusOK, "ok")
}

func photoshop(c *gin.Context) {
	name := c.Query("name")
	safePath, err := validateItemPath(name)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid path"})
		return
	}
	cmd := exec.Command("open", "-a", photoshopApp, safePath)
	cmd.Start()
	c.JSON(http.StatusOK, "ok")
}

func scanFolder(c *gin.Context) {
	path := c.Query("path")
	fullPath, err := filepath.Abs(filepath.Join(dir, path))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid path"})
		return
	}
	rel, relErr := filepath.Rel(dir, fullPath)
	if relErr != nil || strings.HasPrefix(rel, "..") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid path"})
		return
	}

	entries, err := scanFolderNonRecursive(fullPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var files []FileInfo
	for _, entry := range entries {
		if entry.Name() == ".DS_Store" {
			continue
		}

		item := FileInfo{
			Name:  entry.Name(),
			IsDir: entry.IsDir(),
		}

		// Якщо це директорія, підраховуємо файли та статистику
		if entry.IsDir() {
			subDirPath := filepath.Join(fullPath, entry.Name())
			count, _ := countFilesRecursive(subDirPath) // Пропускаємо помилки для стабільності
			item.FileCount = &count

			// Отримуємо статистику по `gp`, `nomad`, `like` для конкретної директорії
			counts, err := countActions(filepath.Join(path, entry.Name()))
			if err == nil {
				item.GP = counts["gp"]
				item.Nomad = counts["nomad"]
				item.Like = counts["like"]
				item.Book = counts["book"]
			}
		}

		files = append(files, item)
	}

	c.JSON(http.StatusOK, files)
}

func scanFolderNonRecursive(path string) ([]fs.DirEntry, error) {
	entries, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}
	return entries, nil
}

// Рекурсивний підрахунок файлів у директорії
func countFilesRecursive(path string) (int, error) {
	var count int
	err := filepath.WalkDir(path, func(_ string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() {
			count++
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	return count, nil
}

// Функція підрахунку `gp`, `nomad`, `like` для певної директорії
func countActions(path string) (map[string]int64, error) {
	counts := map[string]int64{
		"gp":    0,
		"nomad": 0,
		"like":  0,
		"book":  0,
	}

	// `gp`
	var gpCount int64
	db.Model(&Act{}).Where("name LIKE ? AND gp = 1", path+"%").Count(&gpCount)
	counts["gp"] = gpCount

	// `nomad`
	var nomadCount int64
	db.Model(&Act{}).Where("name LIKE ? AND nomad = 1", path+"%").Count(&nomadCount)
	counts["nomad"] = nomadCount

	// `like`
	var likeCount int64
	db.Model(&Act{}).Where("name LIKE ? AND `like` = 1", path+"%").Count(&likeCount)
	counts["like"] = likeCount

	// `book`
	var bookCount int64
	db.Model(&Act{}).Where("name LIKE ? AND `book` = 1", path+"%").Count(&bookCount)
	counts["book"] = bookCount

	return counts, nil
}

func trashBin(c *gin.Context) {
	var actions []Act
	result := db.Where("`delete` = 1").Order("rank DESC").Order("id DESC").Find(&actions)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	c.JSON(http.StatusOK, actions)
}

func emptyTrashBin(c *gin.Context) {
	var actions []Act
	result := db.Where("`delete` = 1").Find(&actions)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	// Видалення файлів
	for _, act := range actions {
		if err := DeleteFile(&act); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	// Видалення записів із БД
	result = db.Where("`delete` = 1").Delete(&Act{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Trash bin emptied"})
}

func getActionsByYear(c *gin.Context) {
	path := c.Query("path")

	var actions []Act
	result := db.Where("name LIKE ?", path+"%").Order("rank DESC").Order("id DESC").Find(&actions)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, actions)
}

func postOrUpdateAction(c *gin.Context) {
	var req ActionRequest
	if c.Request.ContentLength > 0 {
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON body"})
			return
		}
	}

	name := c.Query("name")
	if name == "" {
		name = req.Name
	}
	action := c.Query("action")
	if action == "" {
		action = req.Action
	}
	hasDataPatch := len(req.Data) > 0

	if name == "" || (action == "" && !hasDataPatch) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing name and action/data"})
		return
	}

	var act Act
	result := db.Where("name = ?", name).First(&act)

	if result.Error != nil {
		// Якщо запис не знайдено – створюємо новий
		if result.Error == gorm.ErrRecordNotFound {
			act = Act{Name: name}
			if action != "" {
				applyAction(&act, action)
			}
			if hasDataPatch {
				if err := mergeActionData(&act, req.Data); err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
					return
				}
			}
			db.Create(&act)
			c.JSON(http.StatusCreated, act)
			return
		}

		// Інші помилки БД
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	// Оновлення існуючого запису
	if action != "" {
		applyAction(&act, action)
	}
	if hasDataPatch {
		if err := mergeActionData(&act, req.Data); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}
	db.Save(&act)

	c.JSON(http.StatusOK, act)
}

func mergeActionData(act *Act, patch map[string]interface{}) error {
	existing := map[string]interface{}{}
	if len(act.Data) > 0 {
		if err := json.Unmarshal(act.Data, &existing); err != nil {
			return fmt.Errorf("invalid existing data JSON")
		}
	}
	for k, v := range patch {
		existing[k] = v
	}
	updated, err := json.Marshal(existing)
	if err != nil {
		return fmt.Errorf("invalid data patch")
	}
	act.Data = datatypes.JSON(updated)
	return nil
}

func applyAction(act *Act, action string) {
	switch action {
	case "like":
		if act.Like != nil && *act.Like == 1 {
			val := int8(0)
			act.Like = &val
		} else {
			val := int8(1)
			act.Like = &val
		}
	case "del":
		if act.Delete != nil && *act.Delete == 1 {
			val := int8(0)
			act.Delete = &val
		} else {
			val := int8(1)
			act.Delete = &val
		}
	case "gp":
		if act.GP != nil && *act.GP == 1 {
			val := int8(0)
			act.GP = &val
		} else {
			val := int8(1)
			act.GP = &val
		}
	case "nomad":
		if act.Nomad != nil && *act.Nomad == 1 {
			val := int8(0)
			act.Nomad = &val
		} else {
			val := int8(1)
			act.Nomad = &val
		}
	case "book":
		if act.Book != nil && *act.Book == 1 {
			val := int8(0)
			act.Book = &val
		} else {
			val := int8(1)
			act.Book = &val
		}
	case "up":
		if act.Rank == nil {
			val := 1
			act.Rank = &val
		} else {
			*act.Rank++
		}
	case "down":
		if act.Rank == nil {
			val := -1
			act.Rank = &val
		} else {
			*act.Rank--
		}
	default:
		// Невідомий action – нічого не робимо
	}
}

// DeleteFile видаляє файл за вказаним шляхом
func DeleteFile(act *Act) error {
	safePath, err := validateItemPath(act.Name)
	if err != nil {
		fmt.Printf("invalid path for file %s: %v\n", act.Name, err)
		return nil
	}
	fmt.Println("removing", safePath)
	if err := os.Remove(safePath); err != nil {
		fmt.Printf("не вдалося видалити файл %s\n", act.Name)
	}
	return nil
}

func copyFile(src, dst string) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	// Створюємо цільову папку, якщо її немає
	if err := os.MkdirAll(filepath.Dir(dst), os.ModePerm); err != nil {
		return err
	}

	destinationFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer destinationFile.Close()

	_, err = io.Copy(destinationFile, sourceFile)
	return err
}

func showAllGP(c *gin.Context) {
	var actions []Act
	result := db.Where("gp = 1").Order("rank DESC").Order("id DESC").Find(&actions)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	c.JSON(http.StatusOK, actions)
}

func showAllNomad(c *gin.Context) {
	var actions []Act
	result := db.Where("nomad = 1").Order("rank DESC").Order("id DESC").Find(&actions)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	c.JSON(http.StatusOK, actions)
}

func showAllBook(c *gin.Context) {
	var actions []Act
	result := db.Where("book = 1").Order("rank DESC").Order("id DESC").Find(&actions)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	c.JSON(http.StatusOK, actions)
}

func showAllLiked(c *gin.Context) {
	var actions []Act
	result := db.Where("`like` = 1").Order("rank DESC").Order("id DESC").Find(&actions)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	c.JSON(http.StatusOK, actions)
}

func moveAllToGP(c *gin.Context) {
	var actions []Act
	result := db.Where("gp = 1").Find(&actions)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	for _, act := range actions {
		oldPath := filepath.Join(act.Folder, act.Name)
		newPath := filepath.Join("GP", act.Name)
		if err := os.Rename(oldPath, newPath); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "All GP files moved successfully"})
}

// resizeToFit scales src down to fit within maxSize×maxSize, preserving aspect ratio.
// Returns src unchanged if it already fits.
func resizeToFit(src image.Image, maxSize int) image.Image {
	bounds := src.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	if w <= maxSize && h <= maxSize {
		return src
	}

	newW, newH := maxSize, maxSize
	if w >= h {
		newH = h * maxSize / w
	} else {
		newW = w * maxSize / h
	}
	if newW < 1 {
		newW = 1
	}
	if newH < 1 {
		newH = 1
	}

	dst := image.NewRGBA(image.Rect(0, 0, newW, newH))
	for y := 0; y < newH; y++ {
		for x := 0; x < newW; x++ {
			srcX := bounds.Min.X + x*w/newW
			srcY := bounds.Min.Y + y*h/newH
			r, g, b, a := src.At(srcX, srcY).RGBA()
			dst.SetRGBA(x, y, color.RGBA{
				R: uint8(r >> 8),
				G: uint8(g >> 8),
				B: uint8(b >> 8),
				A: uint8(a >> 8),
			})
		}
	}
	return dst
}

func createThumbnail(srcPath, dstPath string, maxSize int) error {
	f, err := os.Open(srcPath)
	if err != nil {
		return err
	}
	defer f.Close()

	src, format, err := image.Decode(f)
	if err != nil {
		return fmt.Errorf("decode: %w", err)
	}

	thumb := resizeToFit(src, maxSize)

	if err := os.MkdirAll(filepath.Dir(dstPath), 0755); err != nil {
		return err
	}

	out, err := os.Create(dstPath)
	if err != nil {
		return err
	}
	defer out.Close()

	if format == "png" {
		return png.Encode(out, thumb)
	}
	return jpeg.Encode(out, thumb, &jpeg.Options{Quality: 85})
}

func generateThumbs(c *gin.Context) {
	var generated, skipped int
	var errs []string

	err := filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}

		ext := strings.ToLower(filepath.Ext(path))
		if ext != ".jpg" && ext != ".jpeg" && ext != ".png" {
			return nil
		}

		relPath, _ := filepath.Rel(dir, path)
		thumbPath := filepath.Join(thumbsDir, relPath)

		if _, statErr := os.Stat(thumbPath); statErr == nil {
			skipped++
			return nil
		}

		if err := createThumbnail(path, thumbPath, 300); err != nil {
			errs = append(errs, fmt.Sprintf("%s: %v", relPath, err))
			return nil
		}
		generated++
		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"generated": generated,
		"skipped":   skipped,
		"errors":    errs,
	})
}

func main() {
	initConfig()
	initDB()

	r := gin.Default()

	corsOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
	if corsOrigins == "" {
		corsOrigins = "http://localhost:3000"
	}

	// Налаштування CORS
	r.Use(cors.New(cors.Config{
		AllowOrigins:     strings.Split(corsOrigins, ","),
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-API-Key"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	r.Use(authMiddleware())

	r.GET("/scan", scanFolder)
	r.GET("/trash-bin", trashBin)
	r.GET("/all-gp", showAllGP)
	r.GET("/move-gp", moveAllToGP)
	r.GET("/open-item", openItem)
	r.GET("/photoshop", photoshop)
	r.GET("/all-liked", showAllLiked)
	r.GET("/all-nomad", showAllNomad)
	r.GET("/all-book", showAllBook)
	r.GET("/empty", emptyTrashBin)
	r.GET("/actions", getActionsByYear)
	r.POST("/actions", postOrUpdateAction)
	r.POST("/generate-thumbs", generateThumbs)

	r.Run(":" + port)
}

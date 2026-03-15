package main

import (
	"fmt"
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
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

type Act struct {
	ID      uint   `json:"id" gorm:"primaryKey"`
	Name    string `json:"name"`
	Type    string `json:"type"`
	Folder  string `json:"folder"`
	Comment string `json:"comment"`
	Like    *int8  `json:"like"`
	Delete  *int8  `json:"delete"`
	GP      *int8  `json:"gp"`
	Nomad   *int8  `json:"nomad"`
	Rank    *int   `json:"rank"`
}

var db *gorm.DB

const dir = "/Users/mac/www/foto-ill/public/assets/origin"

func initDB() {
	var err error
	dsn := "root:pass@tcp(127.0.0.1:3308)/foto-ill?charset=utf8mb4&parseTime=True&loc=Local"

	db, err = gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Cannot connect to DB:", err)
	}

}

// FileInfo - структура для JSON-відповіді
type FileInfo struct {
	Name      string `json:"name"`
	IsDir     bool   `json:"isDir"`
	FileCount *int   `json:"fileCount,omitempty"` // Nil, якщо це файл
	GP        int64  `json:"gp,omitempty"`
	Nomad     int64  `json:"nomad,omitempty"`
	Like      int64  `json:"like,omitempty"`
}

func openItem(c *gin.Context) {
	name := c.Query("name") // Отримуємо name з параметрів запиту

	if name != "" {
		cmd := exec.Command("open", dir+"/"+name) // Вкажіть шлях до папки
		cmd.Start()
	}

	c.JSON(http.StatusOK, "ok")
}

func photoshop(c *gin.Context) {
	name := c.Query("name") // Отримуємо name з параметрів запиту
	if name != "" {
		cmd := exec.Command("open", "-a", "Adobe Photoshop 2025", dir+"/"+name)
		cmd.Start()
	}

	c.JSON(http.StatusOK, "ok")
}

func scanFolder(c *gin.Context) {
	path := c.Query("path")
	fullPath, err := filepath.Abs(filepath.Join(dir, path))
	if err != nil || !strings.HasPrefix(fullPath, dir) {
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

	return counts, nil
}

func trashBin(c *gin.Context) {
	//path := c.Query("path")

	var actions []Act
	result := db.Where("`delete` = 1 order by id desc").Find(&actions)
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
	result := db.Where("name LIKE ?", path+"%").Find(&actions)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, actions)
}

func postOrUpdateAction(c *gin.Context) {
	name := c.Query("name")     // Отримуємо name з параметрів запиту
	action := c.Query("action") // Отримуємо action з параметрів запиту

	if name == "" || action == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing name or action parameter"})
		return
	}

	var act Act
	result := db.Where("name = ?", name).First(&act)

	if result.Error != nil {
		// Якщо запис не знайдено – створюємо новий
		if result.Error == gorm.ErrRecordNotFound {
			act = Act{Name: name}
			applyAction(&act, action)
			db.Create(&act)
			c.JSON(http.StatusCreated, act)
			return
		}

		// Інші помилки БД
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	// Оновлення існуючого запису
	applyAction(&act, action)
	db.Save(&act)

	c.JSON(http.StatusOK, act)
}

func applyAction(act *Act, action string) {
	switch action {
	case "like":
		if act.Like != nil && *act.Like == 1 {
			// If "like" is already true (1), toggle it to false (0)
			val := int8(0)
			act.Like = &val
		} else {
			// If not, set "like" to true (1)
			val := int8(1)
			act.Like = &val
		}
	case "del":
		if act.Delete != nil && *act.Delete == 1 {
			// If "Delete" is already true (1), toggle it to false (0)
			val := int8(0)
			act.Delete = &val
		} else {
			// If not, set "Delete" to true (1)
			val := int8(1)
			act.Delete = &val
		}
	case "gp":
		if act.GP != nil && *act.GP == 1 {
			// If "GP" is already true (1), toggle it to false (0)
			val := int8(0)
			act.GP = &val
		} else {
			// If not, set "GP" to true (1)
			val := int8(1)
			act.GP = &val
		}
	case "nomad":
		if act.Nomad != nil && *act.Nomad == 1 {
			// If "Nomad" is already true (1), toggle it to false (0)
			val := int8(0)
			act.Nomad = &val
		} else {
			// If not, set "Nomad" to true (1)
			val := int8(1)
			act.Nomad = &val
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
	fmt.Println("removing ", dir+"/"+act.Name)
	err := os.Remove(dir + "/" + act.Name)
	if err != nil {
		fmt.Printf("не вдалося видалити файл %s", act.Name)
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
	result := db.Where("gp = 1").Find(&actions)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	c.JSON(http.StatusOK, actions)
}

func showAllNomad(c *gin.Context) {
	var actions []Act
	result := db.Where("nomad = 1").Find(&actions)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	c.JSON(http.StatusOK, actions)
}

func showAllLiked(c *gin.Context) {
	var actions []Act
	result := db.Where("`like` = 1").Find(&actions)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	c.JSON(http.StatusOK, actions)
}

func copyNomad(c *gin.Context) {
	var actions []Act
	result := db.Where("nomad = 1").Find(&actions)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	for _, act := range actions {
		oldPath := filepath.Join(dir, act.Folder, act.Name)
		newPath := filepath.Join(dir, "NOMAD", act.Name)

		fmt.Println(newPath, oldPath)

		//if err := copyFile(oldPath, newPath); err != nil {
		//	c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		//	return
		//}
	}

	c.JSON(http.StatusOK, gin.H{"message": "All GP files moved successfully"})
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

func main() {
	initDB()

	r := gin.Default()

	// Налаштування CORS
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"}, // Дозволити всі домени
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	r.GET("/scan", scanFolder)
	r.GET("/trash-bin", trashBin)
	r.GET("/all-gp", showAllGP)
	r.GET("/move-gp", moveAllToGP)
	r.GET("/open-item", openItem)
	r.GET("/photoshop", photoshop)
	r.GET("/all-liked", showAllLiked)
	r.GET("/all-nomad", showAllNomad)
	r.GET("/copy-nomad", copyNomad)
	r.GET("/empty", emptyTrashBin)
	r.GET("/actions", getActionsByYear)
	r.POST("/actions", postOrUpdateAction)

	r.Run(":8080")
}

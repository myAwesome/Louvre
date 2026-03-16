import React, {useEffect, useState} from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import {useParams} from 'react-router-dom';

 const FOLDER = "300"

const Sandbox = () => {
    const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080';
    const [data, setData] = useState([]);
    const [random, setRandom] = useState(0);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const {id} = useParams();


    useEffect(() => {
        fetch(`${API_BASE}/all-${id}`)
            .then((response) => response.json())
            .then((json) => {
                setData(Array.isArray(json) ? json : []);
                setLoading(false);
            })
            .catch((error) => {
                setData([]);
                console.error('Помилка при завантаженні folders даних:', error);
                setLoading(false);
            });
    }, [id]);

    const images = data.filter(img => !img.is_dir);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (!showModal) return;
            if (event.key === 'ArrowRight') {
                setCurrentImageIndex((prev) => (prev + 1) % images.length);
            } else if (event.key === 'ArrowLeft') {
                setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
            } else if (event.key === 'Escape') {
                setShowModal(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showModal, images.length]);

    const openModal = (index) => {
        setCurrentImageIndex(index);
        setShowModal(true);
    };
    const closeModal = () => setShowModal(false);

    // const handleEmptyAll = async () => {
    //     try {
    //         setLoading(true)
    //         const response = await fetch(`${HOST}:${PORT}/`, {
    //             method: "GET",
    //         });
    //
    //         setLoading(false)
    //         setRandom(random+1)
    //
    //     } catch (error) {
    //             console.error("Action failed:", error.message);
    //     }
    // }


    if (loading) {
        return <p>Завантаження...</p>;
    }
    return (
        <div>
            <div>
                <h4>{id}: <b>{data.length} </b></h4>
                {/*<button className=" btn btn-danger" onClick={()=>handleEmptyAll()}>Empty All</button>*/}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 40,
                    justifyItems: "center",
                    maxWidth: 1250,
                    margin: "auto"
                }}>
                    {images.map((img, index) => (
                        <div key={index} style={{
                            width: "300px",
                            height: "300px",
                            cursor: "pointer",
                            backgroundColor: img.name.slice(-3) !== "jpg" ? "red" : "transparent"
                        }} onClick={() => openModal(index)}>
                            <div style={{
                                backgroundImage: `url("/assets/${FOLDER}/${img.name}")`,
                                width: "100%",
                                height: "100%",
                                backgroundSize: "cover"
                            }}/>
                        </div>
                    ))}
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={closeModal}>
                    <img
                        onClick={(e) => e.stopPropagation()}
                        className="modal-img"
                        src={`/assets/${FOLDER}/${images[currentImageIndex]?.name}`}
                        alt="Фото"
                    />
                </div>
            )}
        </div>
    );
};

export default Sandbox;

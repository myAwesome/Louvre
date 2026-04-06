import React, {useEffect, useState} from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import {useParams} from 'react-router-dom';

 const FOLDER = "300"

const Sandbox = () => {
    const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080';
    const [data, setData] = useState([]);
    const [actionsData, setActionsData] = useState({});
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const {id} = useParams();


    useEffect(() => {
        fetch(`${API_BASE}/all-${id}`)
            .then((response) => response.json())
            .then((json) => {
                const list = Array.isArray(json) ? json : [];
                const actionsMap = {};
                list.forEach((item) => {
                    if (item?.name) actionsMap[item.name] = item;
                });
                setData(list);
                setActionsData(actionsMap);
                setLoading(false);
            })
            .catch((error) => {
                setData([]);
                setActionsData({});
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

    const handleOpenItem = async (name, type) => {
        await fetch(`${API_BASE}/${type}?name=${encodeURIComponent(name)}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        });
    };

    const handleAction = async (name, action) => {
        try {
            const response = await fetch(`${API_BASE}/actions?name=${encodeURIComponent(name)}&action=${encodeURIComponent(action)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });

            if (!response.ok) throw new Error(`Error: ${response.statusText}`);

            const updatedAction = await response.json();
            setActionsData(prev => ({ ...prev, [name]: updatedAction }));
        } catch (error) {
            console.error("Action failed:", error.message);
        }
    };

    const currentImage = images[currentImageIndex];
    const currentKey = currentImage?.name || "";
    const currentAction = currentKey ? (actionsData[currentKey] || {}) : {};

    if (loading) {
        return <p>Завантаження...</p>;
    }
    return (
        <div className="gallery-wrap">
            <h4>{id}: <b>{images.length}</b></h4>
            <div className="gallery-grid">
                {images.map((img, index) => {
                    const action = actionsData[img.name] || {};
                    const ext = img.name.slice(-3).toLowerCase();
                    const isNonJpg = ext !== "jpg";
                    return (
                        <div key={index} className={`gallery-card${isNonJpg ? " card-non-jpg" : ""}`}>
                            <div
                                className="gallery-thumb"
                                onClick={() => openModal(index)}
                                style={{ backgroundImage: `url("/assets/${FOLDER}/${img.name}")` }}
                            >
                                <span className="gallery-thumb-rank">{action.rank || 0}</span>
                            </div>
                            <div className="card-actions">
                                {isNonJpg && <span className="card-ext">{ext}</span>}
                                <span className="card-idx">{index}</span>
                                <span className="btn btn-sm btn-outline-dark disabled">
                                    R: {action.rank || 0}
                                </span>
                                <button
                                    className={`btn btn-sm ${action.like ? "btn-success" : "btn-outline-secondary"}`}
                                    onClick={() => handleAction(img.name, "like")}>
                                    Like
                                </button>
                                <button
                                    className={`btn btn-sm ${action.delete ? "btn-danger" : "btn-outline-secondary"}`}
                                    onClick={() => handleAction(img.name, "del")}>
                                    Del
                                </button>
                                <button
                                    className={`btn btn-sm ${action.gp ? "btn-warning" : "btn-outline-secondary"}`}
                                    onClick={() => handleAction(img.name, "gp")}>
                                    GP
                                </button>
                                <button
                                    className={`btn btn-sm ${action.nomad ? "btn-primary" : "btn-outline-secondary"}`}
                                    onClick={() => handleAction(img.name, "nomad")}>
                                    Nomad
                                </button>
                                <button
                                    className={`btn btn-sm ${action.book ? "btn-info" : "btn-outline-secondary"}`}
                                    onClick={() => handleAction(img.name, "book")}>
                                    Book
                                </button>
                            </div>
                        </div>
                    );
                })}
                </div>

            {showModal && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-media" onClick={(e) => e.stopPropagation()}>
                        <img
                            className="modal-img"
                            src={`/assets/origin/${currentImage?.name}`}
                            alt="Фото"
                        />
                        <span className="modal-rank-badge">
                            Rank: {currentAction.rank || 0}
                        </span>
                    </div>
                    <div className="modal-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => handleOpenItem(currentKey, "open-item")}>
                            open
                        </button>
                        <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => handleOpenItem(currentKey, "photoshop")}>
                            PS
                        </button>
                        <button
                            className={`btn btn-sm ${currentAction.like ? "btn-success" : "btn-outline-secondary"}`}
                            onClick={() => handleAction(currentKey, "like")}>
                            Like
                        </button>
                        <button
                            className={`btn btn-sm ${currentAction.delete ? "btn-danger" : "btn-outline-secondary"}`}
                            onClick={() => handleAction(currentKey, "del")}>
                            Del
                        </button>
                        <button
                            className={`btn btn-sm ${currentAction.gp ? "btn-warning" : "btn-outline-secondary"}`}
                            onClick={() => handleAction(currentKey, "gp")}>
                            GP
                        </button>
                        <button
                            className={`btn btn-sm ${currentAction.nomad ? "btn-primary" : "btn-outline-secondary"}`}
                            onClick={() => handleAction(currentKey, "nomad")}>
                            Nomad
                        </button>
                        <button
                            className={`btn btn-sm ${currentAction.book ? "btn-info" : "btn-outline-secondary"}`}
                            onClick={() => handleAction(currentKey, "book")}>
                            Book
                        </button>
                        <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleAction(currentKey, "up")}>
                            +
                        </button>
                        <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleAction(currentKey, "down")}>
                            -
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sandbox;

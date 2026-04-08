import React, {useEffect, useState} from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import Table from 'react-bootstrap/Table';
import {Link} from "react-router-dom";
import {useParams} from 'react-router-dom';

const FOLDER = "300"

const BreadcrumbLinks = ({ id }) => {
    if (!id) return <Link to="/folders">root</Link>;
    const parts = id.split("/");
    const links = [];

    for (let i = 0; i < parts.length; i++) {
        const path = parts.slice(0, i + 1).join("/");
        links.push(
            <b key={path}> &nbsp;
                <Link to={`/folders/${encodeURIComponent(path)}`} className="mr-2">
                    {parts[i]}
                </Link> &nbsp;
            </b>
        );
    }

    return <>{links}</>;
};

const Folders = () => {
    const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080';
    const {id} = useParams();
    const path = id || "";

    const [data, setData] = useState([]);
    const [actionsData, setActionsData] = useState({});
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [activeFilters, setActiveFilters] = useState(new Set());


    useEffect(() => {
        fetch(`${API_BASE}/scan?path=${encodeURIComponent(path)}`)
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

        fetch(`${API_BASE}/actions?path=${encodeURIComponent(path)}`)
            .then((response) => response.json())
            .then((json) => {
                const actionsMap = {};
                json.forEach(action => {
                    actionsMap[action.name] = action;
                });
                setActionsData(actionsMap);
            })
            .catch((error) => console.error('Помилка при завантаженні actions:', error));
    }, [path]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (!showModal) return;

            if (event.key === 'ArrowRight') {
                setCurrentImageIndex((prevIndex) => (prevIndex + 1) % data.length);
            } else if (event.key === 'ArrowLeft') {
                setCurrentImageIndex((prevIndex) => (prevIndex - 1 + data.length) % data.length);
            } else if (event.key === 'Escape') {
                setShowModal(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showModal, data.length]);

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
    }

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

    if (loading) return <p style={{padding: 20, color: '#888'}}>Завантаження...</p>;

    const toggleFilter = (filter) => {
        setActiveFilters(prev => {
            const next = new Set(prev);
            if (next.has(filter)) next.delete(filter);
            else next.add(filter);
            return next;
        });
    };

    const filteredData = data.filter(img => {
        if (img.isDir) return false;
        if (activeFilters.size === 0) return true;
        const action = actionsData[`${path}/${img.name}`] || {};
        if (activeFilters.has('unmarked')) {
            if (!action.nomad && !action.like && !action.delete && !action.gp && !action.book) return true;
        }
        if (activeFilters.has('like') && action.like) return true;
        if (activeFilters.has('gp') && action.gp) return true;
        if (activeFilters.has('nomad') && action.nomad) return true;
        if (activeFilters.has('book') && action.book) return true;
        return false;
    });

    const currentImage = filteredData[currentImageIndex];
    const currentKey = currentImage ? `${path}/${currentImage.name}` : "";
    const currentAction = currentKey ? (actionsData[currentKey] || {}) : {};

    return (
        <div className="gallery-wrap">
            <BreadcrumbLinks id={path} />

            <Table striped bordered hover size="sm" style={{marginTop: 10}}>
                <thead>
                <tr>
                    <th>folder</th>
                    <th>files</th>
                    <th>likes</th>
                    <th>gp</th>
                    <th>nomad</th>
                    <th>book</th>
                </tr>
                </thead>
                <tbody>
                {data.map((item) => (
                    item.isDir ? (
                        <tr key={item.name}>
                            <td>
                                📁 <Link to={`/folders/${encodeURIComponent(path ? `${path}/${item.name}` : item.name)}`}>
                                     {item.name}
                                </Link>
                            </td>
                            <td>{item.fileCount}</td>
                            <td>{item.like}</td>
                            <td>{item.gp}</td>
                            <td>{item.nomad}</td>
                            <td>{item.book}</td>
                        </tr>
                    ) : ""
                ))}
                </tbody>
            </Table>

            <div className="filter-bar">
                <button
                    className={`btn btn-sm ${activeFilters.has('unmarked') ? "btn-secondary" : "btn-outline-secondary"}`}
                    onClick={() => toggleFilter('unmarked')}>
                    NO MARKED
                </button>
                <button
                    className={`btn btn-sm ${activeFilters.has('like') ? "btn-success" : "btn-outline-success"}`}
                    onClick={() => toggleFilter('like')}>
                    Like
                </button>
                <button
                    className={`btn btn-sm ${activeFilters.has('gp') ? "btn-warning" : "btn-outline-warning"}`}
                    onClick={() => toggleFilter('gp')}>
                    GP
                </button>
                <button
                    className={`btn btn-sm ${activeFilters.has('nomad') ? "btn-primary" : "btn-outline-primary"}`}
                    onClick={() => toggleFilter('nomad')}>
                    Nomad
                </button>
                <button
                    className={`btn btn-sm ${activeFilters.has('book') ? "btn-info" : "btn-outline-info"}`}
                    onClick={() => toggleFilter('book')}>
                    Book
                </button>
            </div>

            <h4 className="items-count"><b>{filteredData.length}</b> items</h4>

            <div className="gallery-grid">
                {filteredData.map((img, index) => {
                    const key = `${path}/${img.name}`;
                    const action = actionsData[key] || {};
                    const ext = img.name.slice(-3).toLowerCase();
                    const isNonJpg = ext !== "jpg";
                    return (
                        <div key={index} className={`gallery-card${isNonJpg ? " card-non-jpg" : ""}`}>
                            <div
                                className="gallery-thumb"
                                onClick={() => openModal(index)}
                                style={{ backgroundImage: `url("/assets/${FOLDER}/${path}/${img.name}")` }}
                            />
                            <div className="card-actions">
                                {isNonJpg && <span className="card-ext">{ext}</span>}
                                <span className="card-idx">{index}</span>
                                <span className="btn btn-sm btn-outline-dark disabled">
                                    R: {action.rank || 0}
                                </span>
                                <button
                                    className={`btn btn-sm ${action.like ? "btn-success" : "btn-outline-secondary"}`}
                                    onClick={() => handleAction(key, "like")}>
                                    Like
                                </button>
                                <button
                                    className={`btn btn-sm ${action.delete ? "btn-danger" : "btn-outline-secondary"}`}
                                    onClick={() => handleAction(key, "del")}>
                                    Del
                                </button>
                                <button
                                    className={`btn btn-sm ${action.gp ? "btn-warning" : "btn-outline-secondary"}`}
                                    onClick={() => handleAction(key, "gp")}>
                                    GP
                                </button>
                                <button
                                    className={`btn btn-sm ${action.nomad ? "btn-primary" : "btn-outline-secondary"}`}
                                    onClick={() => handleAction(key, "nomad")}>
                                    Nomad
                                </button>
                                <button
                                    className={`btn btn-sm ${action.book ? "btn-info" : "btn-outline-secondary"}`}
                                    onClick={() => handleAction(key, "book")}>
                                    Book
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={closeModal}>
                    <img
                        onClick={(e) => e.stopPropagation()}
                        className="modal-img"
                        src={`/assets/origin/${path}/${currentImage?.name}`}
                        alt="Фото"
                    />
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
                        <span className="btn btn-sm btn-outline-dark disabled">
                            Rank: {currentAction.rank || 0}
                        </span>
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

export default Folders;

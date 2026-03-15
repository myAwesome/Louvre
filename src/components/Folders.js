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
            <b> &nbsp;
                <Link key={path} to={`/folders/${encodeURIComponent(path)}`} className="mr-2">
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
    const path = id || ""; // Якщо id немає, беремо root

    const [data, setData] = useState([]);
    const [actionsData, setActionsData] = useState({});
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [showUnmarkedOnly, setShowUnmarkedOnly] = useState(false);


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

    const handleOpenItem = async (name, type ) => {

        await fetch(`${API_BASE}/${type}?name=${encodeURIComponent(name)}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });
    }


    const handleAction = async (name, action) => {
        try {
            const response = await fetch(`${API_BASE}/actions?name=${encodeURIComponent(name)}&action=${encodeURIComponent(action)}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                throw new Error(`Error: ${response.statusText}`);
            }

            const updatedAction = await response.json();
            setActionsData(prev => ({
                ...prev,
                [name]: updatedAction
            }));
        } catch (error) {
            console.error("Action failed:", error.message);
        }
    };
    if (loading) {
        return <p>Завантаження...</p>;
    }

    const filteredData = data.filter(img => {
        if (img.isDir) return false; // Пропускаємо папки
        if (!showUnmarkedOnly) return true; // Якщо фільтр вимкнено, показуємо все

        const action = actionsData[`${path}/${img.name}`] || {};
        return !action.nomad && !action.like && !action.delete && !action.gp;
    });

    return (
        <div>
            <BreadcrumbLinks id={path} />

            <Table striped bordered hover>
                <thead>
                <tr id="breadcramps">
                    <th>folder</th>
                    <th>files</th>

                    <th>likes</th>
                    <th>gp</th>
                    <th>nomad</th>
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
                            <td> {item.fileCount}</td>

                            <td>{item.like}</td>
                            <td>{item.gp}</td>
                            <td>{item.nomad}</td>
                        </tr>
                    ) : ""
                ))}
                </tbody>
            </Table>
            <div style={{ marginBottom: "10px" }}>
                <input
                    type="checkbox"
                    id="unmarked-filter"
                    checked={showUnmarkedOnly}
                    onChange={() => setShowUnmarkedOnly(prev => !prev)}
                />
                <label htmlFor="unmarked-filter"> NO MARKED</label>
            </div>


            <div>
                <h4><b>{filteredData.length}</b> items</h4>
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 40,
                    justifyItems: "center",
                    maxWidth: 1250,
                    margin: "auto"
                }}>
                    {filteredData.map((img, index) => (
                        img.isDir ? "" : (
                            <div key={index} style={{
                                width: "300px",
                                height: "300px",
                                cursor: "pointer",
                                backgroundColor: img.name.slice(-3) !== "jpg" ? "white" : "transparent"
                            }}>
                                <div onClick={() => openModal(index)}
                                     style={{
                                         backgroundImage: `url("/assets/${FOLDER}/${path}/${img.name}")`,
                                         width: "100%",
                                         height: "100%",
                                         backgroundSize: "cover"
                                     }}/>

                                <div style={{display: "flex", justifyContent: "center", gap: 5, marginTop: 5}}>
                                    <b>{img.name.slice(-3).toLowerCase() !== "jpg" ? img.name.slice(-3) : " "} </b>
                                    <span>{index}</span>
                                    <button
                                        className={`btn btn-sm ${actionsData[`${path}/${img.name}`]?.like ? "btn-success" : "btn-outline-secondary"}`}
                                        onClick={() => handleAction(`${path}/${img.name}`, "like")}>
                                        Like
                                    </button>
                                    <button
                                        className={`btn btn-sm ${actionsData[`${path}/${img.name}`]?.delete ? "btn-danger" : "btn-outline-secondary"}`}
                                        onClick={() => handleAction(`${path}/${img.name}`, "del")}>
                                        Del
                                    </button>
                                    <button
                                        className={`btn btn-sm ${actionsData[`${path}/${img.name}`]?.gp ? "btn-warning" : "btn-outline-secondary"}`}
                                        onClick={() => handleAction(`${path}/${img.name}`, "gp")}>
                                        GP
                                    </button>
                                    <button
                                        className={`btn btn-sm ${actionsData[`${path}/${img.name}`]?.nomad ? "btn-primary" : "btn-outline-secondary"}`}
                                        onClick={() => handleAction(`${path}/${img.name}`, "nomad")}>
                                        nomad
                                    </button>
                                    {/*<button className="btn btn-sm btn-primary"*/}
                                    {/*        onClick={() => handleAction(`${path}/${img.name}`, "up")}>*/}
                                    {/*    +*/}
                                    {/*</button>*/}
                                    {/*<span style={{*/}
                                    {/*    fontSize: "18px",*/}
                                    {/*    fontWeight: "bold",*/}
                                    {/*    minWidth: "30px",*/}
                                    {/*    textAlign: "center"*/}
                                    {/*}}>*/}
                                    {/*    {actionsData[`${path}/${img.name}`]?.rank ?? 0}*/}
                                    {/*</span>*/}
                                    {/*<button className="btn btn-sm btn-primary"*/}
                                    {/*        onClick={() => handleAction(`${path}/${img.name}`, "down")}>*/}
                                    {/*    -*/}
                                    {/*</button>*/}
                                </div>
                            </div>
                        )
                    ))}
                </div>
            </div>

            {showModal && (
                <div onClick={closeModal} style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backdropFilter: "blur(4px)",
                    backgroundColor: "rgba(0,0,0,.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column"
                }}>
                    <img
                        onClick={(e) => e.stopPropagation()}
                        className="img-fluid"
                        src={`/assets/origin/${path}/${filteredData[currentImageIndex]?.name}`}
                        alt="Фото"
                        style={{
                            maxWidth: '90vw',
                            height: 'auto',
                            maxHeight: '90vh',
                            objectFit: 'contain'
                        }}
                    />
                    <div style={{
                        backgroundColor: "#fff",
                        display: "flex",
                        gap: "5px",
                        padding: "5px",
                        marginTop: "5px",
                        borderRadius: "5px"
                    }}
                         onClick={(e) => e.stopPropagation()}
                    >
                        <button
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => handleOpenItem(`${path}/${filteredData[currentImageIndex]?.name}`, "open-item")}>open
                            </button>

                        <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => handleOpenItem(`${path}/${filteredData[currentImageIndex]?.name}`, "photoshop")}>PS
                        </button>

                        <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => handleAction(`${path}/${filteredData[currentImageIndex]?.name}`, "like")}>
                            Like
                        </button>
                        <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => handleAction(`${path}/${filteredData[currentImageIndex]?.name}`, "del")}>
                            Del
                        </button>
                        <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => handleAction(`${path}/${filteredData[currentImageIndex]?.name}`, "gp")}>
                            GP
                        </button>
                        <button
                            className={`btn btn-sm "btn-primary" : "btn-outline-secondary"}`}
                            onClick={() => handleAction(`${path}/${filteredData[currentImageIndex]?.name}`, "nomad")}>
                            nomad
                        </button>
                        <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleAction(`${path}/${filteredData[currentImageIndex]?.name}`, "up")}>
                            +
                        </button>

                        <button className="btn btn-sm btn-primary"
                                onClick={() => handleAction(`${path}/${filteredData[currentImageIndex]?.name}`, "down")}>
                            -
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Folders;

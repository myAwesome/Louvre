import React, {useEffect, useState} from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import {useParams} from 'react-router-dom';

const FOLDER = "origin"

const Sandbox = () => {
    const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080';
    const [data, setData] = useState([]);
    const [random, setRandom] = useState(0);
    const [loading, setLoading] = useState(true);
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
                    {data.map((img, index) => (
                        img.is_dir ? "" : (
                            <div key={index} style={{
                                width: "300px",
                                height: "300px",
                                cursor: "pointer",
                                backgroundColor: img.name.slice(-3) !== "jpg" ? "red" : "transparent"
                            }}>
                                <div style={{
                                         // backgroundImage: `url("/assets/${FOLDER}/${id}/${img.name}")`,
                                         backgroundImage: `url("/assets/${FOLDER}/${img.name}")`,
                                         width: "100%",
                                         height: "100%",
                                         backgroundSize: "cover"
                                     }}/>
                            </div>
                        )
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Sandbox;

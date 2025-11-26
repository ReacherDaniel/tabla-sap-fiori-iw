import { useState, useEffect } from "react";
import {
    Button,
    Dialog,
    Bar,
    Label,
    ComboBox,
    ComboBoxItem,
    CheckBox,
} from "@ui5/webcomponents-react";

const ModalFiltroET = ({
    isModalOpen,
    handleCloseModal,
    handleAplicarFiltros,
    etiquetasCatalog,
    currentFilters
}) => {
    const [fechaSeleccionada, setFechaSeleccionada] = useState("todos");
    const [coleccionesSeleccionadas, setColeccionesSeleccionadas] = useState([]);
    const [seccionesSeleccionadas, setSeccionesSeleccionadas] = useState([]);

    // Extraer colecciones y secciones únicas del catálogo completo de etiquetas
    const coleccionesUnicas = [...new Set(etiquetasCatalog
        .map(et => et.COLECCION)
        .filter(col => col && col.trim() !== "")
    )].sort();

    const seccionesUnicas = [...new Set(etiquetasCatalog
        .map(et => et.SECCION)
        .filter(sec => sec && sec.trim() !== "")
    )].sort();

    const opcionesFecha = [
        { key: "todos", text: "Todos" },
        { key: "1M", text: "Último mes" },
        { key: "3M", text: "Últimos 3 meses" },
        { key: "6M", text: "Últimos 6 meses" },
        { key: "1Y", text: "Último año" },
    ];

    const toggleColeccion = (coleccion) => {
        setColeccionesSeleccionadas(prev =>
            prev.includes(coleccion)
                ? prev.filter(c => c !== coleccion)
                : [...prev, coleccion]
        );
    };

    const toggleSeccion = (seccion) => {
        setSeccionesSeleccionadas(prev =>
            prev.includes(seccion)
                ? prev.filter(s => s !== seccion)
                : [...prev, seccion]
        );
    };

    // Función para manejar el cambio del checkbox
    const handleCheckboxChange = (type, value) => {
        if (type === 'coleccion') {
            toggleColeccion(value);
        } else {
            toggleSeccion(value);
        }
    };

    // Función para aplicar los filtros
    const aplicarFiltros = () => {
        const nuevosFiltros = {
            ultFechaMod: fechaSeleccionada,
            coleccion: coleccionesSeleccionadas,
            seccion: seccionesSeleccionadas,
        };
        handleAplicarFiltros(nuevosFiltros);
    };

    // Efecto para inicializar con los filtros actuales cuando se abre el modal
    useEffect(() => {
        if (isModalOpen) {
            setFechaSeleccionada(currentFilters.ultFechaMod || "todos");
            setColeccionesSeleccionadas(currentFilters.coleccion || []);
            setSeccionesSeleccionadas(currentFilters.seccion || []);
        }
    }, [isModalOpen, currentFilters]);

    return (
        <Dialog
            stretch={false}
            open={isModalOpen}
            onAfterClose={handleCloseModal}
            headerText="Filtrar Etiquetas"
            style={{
                width: "450px",
                maxWidth: "90vw",
            }}
            footer={
                <Bar
                    endContent={
                        <>
                            <Button
                                design="Emphasized"
                                onClick={aplicarFiltros}
                            >
                                Aplicar Filtros
                            </Button>
                            <Button
                                design="Transparent"
                                onClick={handleCloseModal}
                            >
                                Cancelar
                            </Button>
                        </>
                    }
                />
            }
        >
            <div style={{
                padding: "1rem",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                gap: "1.5rem"
            }}>
                {/* Fecha de última modificación */}
                <div>
                    <Label>
                        Fecha de última modificación
                    </Label>
                    <ComboBox
                        value={opcionesFecha.find(op => op.key === fechaSeleccionada)?.text || ""}
                        onSelectionChange={(e) => {
                            const selectedItem = e.detail.item;
                            const selectedKey = selectedItem?.dataset.key;
                            setFechaSeleccionada(selectedKey || "todos");
                        }}
                        style={{ width: '100%' }}
                    >
                        {opcionesFecha.map(opcion => (
                            <ComboBoxItem
                                key={opcion.key}
                                data-key={opcion.key}
                                text={opcion.text}
                            />
                        ))}
                    </ComboBox>
                </div>

                <div style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1.5rem",
                    flex: 1,
                    minHeight: 0
                }}>
                    {/* Columna Colección */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                        <Label>
                            Colección
                        </Label>
                        <div style={{
                            flex: 1,
                            overflow: "auto",
                            borderRadius: "0.375rem",
                            padding: "0.5rem",
                            maxHeight: "200px"
                        }}>
                            {coleccionesUnicas.map(coleccion => (
                                <div
                                    key={coleccion}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                        cursor: "pointer",
                                        marginBottom: "0.125rem",
                                        borderBottom: "1px solid #d9d9d9"
                                    }}
                                    onClick={() => toggleColeccion(coleccion)}
                                >
                                    <CheckBox
                                        checked={coleccionesSeleccionadas.includes(coleccion)}
                                        onChange={() => handleCheckboxChange('coleccion', coleccion)}
                                        style={{ margin: 0 }}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <span style={{ userSelect: "none" }}>{coleccion}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Columna Sección */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                        <Label>
                            Sección
                        </Label>
                        <div style={{
                            flex: 1,
                            overflow: "auto",
                            maxHeight: "200px"
                        }}>
                            {seccionesUnicas.map(seccion => (
                                <div
                                    key={seccion}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                        cursor: "pointer",
                                        marginBottom: "0.125rem",
                                        borderBottom: "1px solid #d9d9d9",
                                    }}
                                    onClick={() => toggleSeccion(seccion)}
                                >
                                    <CheckBox
                                        checked={seccionesSeleccionadas.includes(seccion)}
                                        onChange={() => handleCheckboxChange('seccion', seccion)}
                                        style={{ margin: 0 }}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <span style={{ userSelect: "none" }}>{seccion}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </Dialog>
    );
};

export default ModalFiltroET;
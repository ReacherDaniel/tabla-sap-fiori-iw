import { useState, useEffect } from "react";
import {
    Button,
    Input,
    Dialog,
    Bar,
    Label,
    ComboBox,
    ComboBoxItem,
    TextArea,
    FlexBox,
    Icon,
} from "@ui5/webcomponents-react";

const ModalEditGrupoET = ({ isModalOpen, handleCloseModal, setGrupoET, etiquetas, valores, sociedadSeleccionada, cediSeleccionado }) => {

    const [etiqueta, setEtiqueta] = useState("");
    const [valor, setValor] = useState("");

    const [filteredEtiquetas, setFilteredEtiquetas] = useState([]);
    const [filteredValores, setFilteredValores] = useState([]);

    const limpiarEstado = () => {
        setEtiqueta("");
        setValor("");
        setFilteredEtiquetas([]);
        setFilteredValores([]);
    };

    useEffect(() => {
        if (isModalOpen && sociedadSeleccionada && cediSeleccionado) {
            const etiquetasFiltradas = etiquetas.filter(et =>
                et.IDSOCIEDAD?.toString() === sociedadSeleccionada.toString() &&
                et.IDCEDI?.toString() === cediSeleccionado.toString()
            );
            setFilteredEtiquetas(etiquetasFiltradas);
        } else {
            // Si el modal no está abierto o faltan datos, limpiar
            limpiarEstado();
        }
    }, [isModalOpen, sociedadSeleccionada, cediSeleccionado, etiquetas]);

    const handleAceptar = () => {
        if (etiqueta && valor) {
            setGrupoET(`${etiqueta}-${valor}`);
            handleCloseModal(); // Cierra el modal
        } else {
            alert("Por favor, selecciona una etiqueta y un valor.");
        }
    };

    const handleCerrar = () => {
        limpiarEstado();
        handleCloseModal();
    };

    return (
        <Dialog
            stretch={false}
            open={isModalOpen}
            onAfterClose={handleCerrar} // Limpia el estado al cerrar
            headerText="Definir Grupo ET"
            style={{
                width: "500px",  // o el ancho que prefieras
                maxWidth: "90vw" // mantiene responsive
            }}
            footer={
                <Bar
                    endContent={
                        <>
                            <Button
                                design="Emphasized"
                                onClick={handleAceptar}
                                className="btn-guardar-modal"
                            >
                                Aceptar
                            </Button>
                            <Button design="Transparent" onClick={handleCerrar}>
                                Cancelar
                            </Button>
                        </>
                    }
                />
            }
            className="modal-sku"
        >
            <div className="modal-content">
                <FlexBox
                    direction="Column"
                    justifyContent="Center"
                    alignItems="Center"
                    wrap="Nowrap"
                    className="modal-form-fields"
                    style={{ gap: '1rem', width: '100%' }}
                >
                    <div className="modal-field">
                        <Label required>Grupo ET - Etiqueta</Label>
                        <ComboBox
                            className="modal-combobox"
                            value={etiqueta}
                            onSelectionChange={(e) => {
                                const selectedItem = e.detail.item;
                                const selectedKey = selectedItem?.dataset.key;
                                setEtiqueta(selectedKey);
                                // Limpiar valor y filtrar
                                setValor("");
                                const valoresFiltrados = valores.filter(v => v.parentEtiqueta === selectedKey);
                                setFilteredValores(valoresFiltrados);
                            }}
                            placeholder="Selecciona una etiqueta"
                            filter="Contains"
                            style={{ width: '400px' }}
                        >
                            {filteredEtiquetas.map(item =>
                                <ComboBoxItem key={item.key} data-key={item.key} text={item.text} />
                            )}
                        </ComboBox>
                    </div>
                    <div className="modal-field">
                        <Label required>Grupo ET - Valor</Label>
                        <ComboBox
                            disabled={!etiqueta}
                            className="modal-combobox"
                            value={valor}
                            onSelectionChange={(e) => {
                                const selectedItem = e.detail.item;
                                const selectedKey = selectedItem?.dataset.key;
                                setValor(selectedKey);
                            }}
                            placeholder="Selecciona un valor"
                            filter="Contains"
                            style={{ width: '400px' }}
                        >
                            {filteredValores.map(item =>
                                <ComboBoxItem key={item.key} data-key={item.key} text={item.text} />
                            )}
                        </ComboBox>
                    </div>
                    <div className="modal-field">
                        <Label>Resultado (Etiqueta-Valor)</Label>
                        <div className="grupo-et-container">
                            <Input
                                value={etiqueta && valor ? `${etiqueta}-${valor}` : ""}
                                icon={null}
                                type="Text"
                                valueState="None"
                                disabled
                            />
                        </div>
                    </div>
                </FlexBox>
            </div>
        </Dialog>
    );
};

export default ModalEditGrupoET;
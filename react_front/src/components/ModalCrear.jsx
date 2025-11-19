import axios from "axios";
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
import ModalEditGrupoET from "./ModalEditGrupoET.jsx";

// Constantes para consultar el backend del equipo de miguellopez corriendo en localhost
const URL_BASE_BACKEND_MIGUEL = "http://localhost:3034";

const URL_BASE_BACKEND_CINNALOVERS = "https://app-restful-sap-cds.onrender.com";
const LOGGED_USER = "FMIRADAJ";


const ModalCrear = ({ isModalOpen, handleCloseModal, dbConnection, refetchData }) => {

    const [sociedadesCatalog, setSociedadesCatalog] = useState([]);
    const [cedisCatalog, setCedisCatalog] = useState([]);
    const [etiquetasCatalog, setEtiquetasCatalog] = useState([]);
    const [valoresCatalog, setValoresCatalog] = useState([]);

    // Estados para los catálogos filtrados
    const [filteredCedisCatalog, setFilteredCedisCatalog] = useState([]);
    const [filteredEtiquetasCatalog, setFilteredEtiquetasCatalog] = useState([]);
    const [filteredValoresCatalog, setFilteredValoresCatalog] = useState([]);

    // Estados para los campos del formulario
    const [sociedad, setSociedad] = useState("");
    const [cedis, setCedis] = useState("");
    const [etiqueta, setEtiqueta] = useState("");
    const [valor, setValor] = useState("");
    const [grupoET, setGrupoET] = useState("");
    const [id, setid] = useState("");
    const [infoAdicional, setInfoAdicional] = useState("");

    // console.log("sociedades",sociedadesCatalog);
    // console.log("cedis", cedisCatalog);
    // console.log("etiquetas", etiquetasCatalog);
    // console.log("valores", valoresCatalog);

    const [isModalEditGrupoETOpen, setIsModalEditGrupoETOpen] = useState(false);

    useEffect(() => {
        const fetchCatalogos = async () => {
            if (!isModalOpen) return;
            try {
                const url = `${URL_BASE_BACKEND_MIGUEL}/api/cat/crudLabelsValues?ProcessType=GetAll&LoggedUser=MIGUELLOPEZ&DBServer=${dbConnection === "Azure" ? "CosmosDB" : "MongoDB"}`;
                const response = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        operations: [
                            {
                                collection: "LabelsValues",
                                action: "GETALL",
                                payload: {}
                            }
                        ]
                    }),
                });

                if (!response.ok) {
                    console.log(`Error HTTP: ${response.status}`);
                }

                const data = await response.json();
                const registros = data.data?.[0]?.dataRes || [];

                if (!Array.isArray(registros) || registros.length === 0) {
                    return;
                }

                const sociedades = [];
                const cedis = [];
                const etiquetas = [];
                const valores = [];

                registros.forEach((item) => {
                    // SOCIEDADES
                    if (item.IDSOCIEDAD && !sociedades.some((s) => s.key === item.IDSOCIEDAD)) {
                        sociedades.push({
                            key: item.IDSOCIEDAD,
                            text: `Sociedad ${item.IDSOCIEDAD}`,
                        });
                    }

                    // CEDIS
                    if (
                        item.IDSOCIEDAD &&
                        item.IDCEDI &&
                        !cedis.some((c) => c.key === item.IDCEDI && c.parentSoc === item.IDSOCIEDAD)
                    ) {
                        cedis.push({
                            key: item.IDCEDI,
                            text: `Cedi ${item.IDCEDI}`,
                            parentSoc: item.IDSOCIEDAD,
                        });
                    }

                    // ETIQUETAS
                    // Guardar etiqueta COMPLETA en etiquetasAll
                    // ETIQUETAS (IDS reales + conservar COLECCION/SECCION para filtros)
                    if (item.IDETIQUETA && item.IDSOCIEDAD && item.IDCEDI && !etiquetas.some((e) => e.key === item.IDETIQUETA)) {
                        etiquetas.push({
                            key: item.IDETIQUETA,
                            text: item.IDETIQUETA,
                            IDETIQUETA: item.IDETIQUETA,
                            ETIQUETA: item.ETIQUETA,
                            IDSOCIEDAD: item.IDSOCIEDAD,
                            IDCEDI: item.IDCEDI,
                            COLECCION: item.COLECCION || "",
                            SECCION: item.SECCION || "",
                            _raw: item
                        });
                    }

                    const etiquetasSimplificadas = etiquetas.map(e => ({
                        key: e.IDETIQUETA,
                        text: e.ETIQUETA || e.IDETIQUETA,
                        IDSOCIEDAD: e.IDSOCIEDAD,
                        IDCEDI: e.IDCEDI
                    }));

                    // VALORES anidados
                    if (Array.isArray(item.valores)) {
                        item.valores.forEach((v) => {
                            valores.push({
                                key: v.IDVALOR,     // ID REAL
                                text: v.IDVALOR,
                                IDVALOR: v.IDVALOR,
                                VALOR: v.VALOR,
                                IDSOCIEDAD: v.IDSOCIEDAD,
                                IDCEDI: v.IDCEDI,
                                parentEtiqueta: item.IDETIQUETA
                            });
                        });
                    }
                });

                setCedisCatalog(cedis);
                setEtiquetasCatalog(etiquetas);
                setValoresCatalog(valores);
                setSociedadesCatalog(sociedades);

            } catch (error) {
                console.error('Error fetching data:', error);
            }
        }
        fetchCatalogos();
    }, [isModalOpen]);

    const handleGuardar = async () => {
        try {
            const registro = {
                IDSOCIEDAD: Number(sociedad),
                IDCEDI: Number(cedis),
                IDETIQUETA: etiqueta,
                IDVALOR: valor,
                INFOAD: infoAdicional,
                IDGRUPOET: grupoET,
                ID: id,
                ACTIVO: true,
            };

            const processType = "Create";
            const url = `${URL_BASE_BACKEND_CINNALOVERS}/api/security/gruposet/crud?ProcessType=${processType}&DBServer=${dbConnection}&LoggedUser=${LOGGED_USER}`;

            console.log(`📤 Enviando ${processType} a:`, url);
            console.log("📦 Datos:", registro);

            const res = await axios.post(url, registro, {
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (res.data?.success || res.status === 200) {
                alert(`✅ Registro creado correctamente`);

                refetchData();
            } else {
                alert(`⚠️ Error al crear el registro`);
            }

            limpiarFormulario();
            handleCloseModal();
        } catch (error) {
            if (error.status === 409) {
                alert("❌ Ya existe un registro con esos datos. No se puede actualizar.");
            } else {
                console.error("❌ Error al guardar:", error);
                alert("Error al guardar el registro: " + error.message);
            }
            //limpiarFormulario();
            //handleCloseModal();
        }
    };

    const limpiarFormulario = () => {
        setSociedad("");
        setCedis("");
        setEtiqueta("");
        setValor("");
        setGrupoET("");
        setid("");
        setInfoAdicional("");
        // Limpiar también los catálogos filtrados
        setFilteredCedisCatalog([]);
        setFilteredEtiquetasCatalog([]);
        setFilteredValoresCatalog([]);
    };

    const handleCancelar = () => {
        limpiarFormulario();
        handleCloseModal();
    };

    return (
        <>
            <Dialog
                stretch={false}
                open={isModalOpen}
                onAfterClose={handleCancelar}
                headerText="Registro"
                style={{
                    width: "600px",  // o el ancho que prefieras
                    maxWidth: "90vw" // mantiene responsive
                }}
                footer={
                    <Bar
                        endContent={
                            <>
                                <Button
                                    design="Emphasized"
                                    icon="add"
                                    onClick={handleGuardar}
                                    className="btn-guardar-modal"
                                >
                                    Guardar cambios
                                </Button>
                                <Button design="Transparent" onClick={handleCancelar}>
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
                            <Label required>Sociedad</Label>
                            <ComboBox
                                className="modal-combobox"
                                value={sociedad ? `Sociedad ${sociedad}` : ""}
                                onSelectionChange={(e) => {
                                    const selectedItem = e.detail.item;
                                    const selectedKey = selectedItem?.dataset.key;
                                    setSociedad(selectedKey);
                                    // Limpiar selecciones dependientes
                                    setCedis("");
                                    setEtiqueta("");
                                    setValor("");
                                    setFilteredCedisCatalog([]);
                                    setFilteredEtiquetasCatalog([]);
                                    setFilteredValoresCatalog([]);
                                    // Filtrar CEDIS
                                    const filtered = cedisCatalog.filter(c => c.parentSoc.toString() === selectedKey);
                                    setFilteredCedisCatalog(filtered);
                                }}
                                placeholder="Selecciona una sociedad"
                                filter="Contains"
                                style={{ width: '400px' }}
                            >
                                {sociedadesCatalog.map(item =>
                                    <ComboBoxItem key={item.key} data-key={item.key} text={item.text} />
                                )}
                            </ComboBox>
                        </div>

                        <div className="modal-field">
                            <Label required>CEDI</Label>
                            <ComboBox
                                className="modal-combobox"
                                value={cedis ? `Cedi ${cedis}` : ""}
                                disabled={!sociedad}
                                onSelectionChange={(e) => {
                                    const selectedItem = e.detail.item;
                                    const selectedKey = selectedItem?.dataset.key;
                                    setCedis(selectedKey);
                                    // Limpiar selecciones dependientes
                                    setEtiqueta("");
                                    setValor("");
                                    setFilteredEtiquetasCatalog([]);
                                    setFilteredValoresCatalog([]);
                                    // Filtrar Etiquetas
                                    const filtered = etiquetasCatalog.filter(et => et.IDSOCIEDAD && et.IDCEDI && et.IDSOCIEDAD.toString() === sociedad && et.IDCEDI.toString() === selectedKey);
                                    setFilteredEtiquetasCatalog(filtered);
                                }}
                                placeholder="Selecciona un CEDI"
                                filter="Contains"
                                style={{ width: '400px' }}
                            >
                                {filteredCedisCatalog.map(item =>
                                    <ComboBoxItem key={item.key} data-key={item.key} text={item.text} />
                                )}
                            </ComboBox>
                        </div>

                        <div className="modal-field">
                            <Label required>Etiqueta</Label>
                            <ComboBox
                                className="modal-combobox"
                                value={etiqueta}
                                disabled={!cedis}
                                onSelectionChange={(e) => {
                                    const selectedItem = e.detail.item;
                                    const selectedKey = selectedItem?.dataset.key;
                                    setEtiqueta(selectedKey);
                                    // Limpiar selección dependiente
                                    setValor("");
                                    setFilteredValoresCatalog([]);
                                    // Filtrar Valores
                                    const filtered = valoresCatalog.filter(v => v.parentEtiqueta === selectedKey);
                                    setFilteredValoresCatalog(filtered);
                                }}
                                placeholder="Selecciona una etiqueta"
                                filter="Contains"
                                style={{ width: '400px' }}
                            >
                                {filteredEtiquetasCatalog.map(item =>
                                    <ComboBoxItem key={item.key} data-key={item.key} text={item.text} />
                                )}
                            </ComboBox>
                        </div>

                        <div className="modal-field">
                            <Label required>Valor</Label>
                            <ComboBox
                                className="modal-combobox"
                                value={valor}
                                disabled={!etiqueta}
                                onSelectionChange={(e) => {
                                    const selectedItem = e.detail.item;
                                    const selectedKey = selectedItem?.dataset.key;
                                    setValor(selectedKey);
                                    // No hay más campos que limpiar/filtrar
                                }}
                                placeholder="Seleccione un valor"
                                filter="Contains"
                                style={{ width: '400px' }}
                            >
                                {filteredValoresCatalog.map(item =>
                                    <ComboBoxItem key={item.key} data-key={item.key} text={item.text} />
                                )}
                            </ComboBox>
                        </div>

                        <div className="modal-field">
                            <Label required>Grupo ET</Label>
                            <div className="grupo-et-container">
                                <Input
                                    icon={null}
                                    type="Text"
                                    valueState="None"
                                    disabled={true}
                                    value={grupoET}
                                />
                                <Button
                                    icon="edit"
                                    onClick={() => setIsModalEditGrupoETOpen(true)}
                                    title="Editar Grupo ET"
                                    className="btn-editar-grupo"
                                />
                            </div>
                        </div>

                        <div className="modal-field">
                            <Label required>ID</Label>
                            <Input
                                className="modal-input"
                                value={id}
                                placeholder="id grupo"
                                onChange={(e) => setid(e.target.value)}
                                style={{ width: '400px' }}
                            />
                        </div>
                    </FlexBox>

                    <div className="modal-field">
                        <Label className="textarea-label">Información adicional</Label>
                        <TextArea
                            placeholder="Escriba información adicional..."
                            className="modal-textarea"
                            onChange={(e) => setInfoAdicional(e.target.value)}
                            value={infoAdicional}
                            style={{ width: '400px' }}
                        />
                    </div>
                </div>
            </Dialog>
            <ModalEditGrupoET
                isModalOpen={isModalEditGrupoETOpen}
                handleCloseModal={() => {
                    setIsModalEditGrupoETOpen(false);
                }}
                setGrupoET={setGrupoET}
                dbConnection={dbConnection}
                etiquetas={etiquetasCatalog}
                sociedadSeleccionada={sociedad}
                cediSeleccionado={cedis}
                valores={valoresCatalog}
            />
        </>
    );
}

export default ModalCrear;
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
} from "@ui5/webcomponents-react";
import ModalEditGrupoET from "./ModalEditGrupoET.jsx";
import ButtonDesign from "@ui5/webcomponents/dist/types/ButtonDesign.js";
import ModalFiltroET from "./ModalFiltroET.jsx";

const URL_BASE_BACKEND_CINNALOVERS = "https://app-restful-sap-cds.onrender.com";
const LOGGED_USER = "FMIRADAJ";

const ModalEditar = ({
    isModalOpen,
    handleCloseModal,
    dbConnection,
    refetchData,
    sociedadesCatalog,
    cedisCatalog,
    etiquetasCatalog,
    valoresCatalog,
    showToastMessage,
    registroEditar, // Nuevo prop: datos del registro a editar
}) => {

    const [isLoading, setIsLoading] = useState(false);
    const [isModalFiltroETOpen, setIsModalFiltroETOpen] = useState(false);
    const [isModalEditGrupoETOpen, setIsModalEditGrupoETOpen] = useState(false);

    // Estados para los catálogos filtrados
    const [filteredCedisCatalog, setFilteredCedisCatalog] = useState([]);
    const [filteredEtiquetasCatalog, setFilteredEtiquetasCatalog] = useState([]);
    const [filteredEtiquetasCatalogOriginal, setFilteredEtiquetasCatalogOriginal] = useState([]);
    const [filteredValoresCatalog, setFilteredValoresCatalog] = useState([]);

    // Estados para los campos del formulario - INICIALIZADOS CON LOS DATOS DEL REGISTRO
    const [sociedad, setSociedad] = useState(registroEditar?.sociedad || "");
    const [cedis, setCedis] = useState(registroEditar?.sucursal || "");
    const [etiqueta, setEtiqueta] = useState(registroEditar?.etiqueta || "");
    const [valor, setValor] = useState(registroEditar?.valor || "");
    const [grupoET, setGrupoET] = useState(registroEditar?.idgroup || "");
    const [id, setId] = useState(registroEditar?.idg || "");
    const [infoAdicional, setInfoAdicional] = useState(registroEditar?.info || "");

    // Estado de filtro para las etiquetas
    const [filters, setFilters] = useState({
        ultFechaMod: "todos",
        coleccion: [],
        seccion: [],
    });

    // Efecto para inicializar los datos cuando cambia el registro a editar
    useEffect(() => {
        if (registroEditar) {
            setSociedad(registroEditar.sociedad || "");
            setCedis(registroEditar.sucursal || "");
            setEtiqueta(registroEditar.etiqueta || "");
            setValor(registroEditar.valor || "");
            setGrupoET(registroEditar.idgroup || "");
            setId(registroEditar.idg || "");
            setInfoAdicional(registroEditar.info || "");

            // Inicializar catálogos filtrados basados en el registro
            if (registroEditar.sociedad) {
                const cedisFiltrados = cedisCatalog.filter(c => 
                    c.parentSoc?.toString() === registroEditar.sociedad?.toString()
                );
                setFilteredCedisCatalog(cedisFiltrados);
            }

            if (registroEditar.sociedad && registroEditar.sucursal) {
                const etiquetasFiltradas = etiquetasCatalog.filter(et =>
                    et.IDSOCIEDAD?.toString() === registroEditar.sociedad?.toString() &&
                    et.IDCEDI?.toString() === registroEditar.sucursal?.toString()
                );
                setFilteredEtiquetasCatalog(etiquetasFiltradas);
                setFilteredEtiquetasCatalogOriginal(etiquetasFiltradas);
            }

            if (registroEditar.etiqueta) {
                const valoresFiltrados = valoresCatalog.filter(v =>
                    v.parentEtiqueta === registroEditar.etiqueta
                );
                setFilteredValoresCatalog(valoresFiltrados);
            }
        }
    }, [registroEditar, cedisCatalog, etiquetasCatalog, valoresCatalog]);

    // Función para aplicar filtros a las etiquetas (igual que en ModalCrear)
    const applyFilters = (etiquetas, filtros) => {
        if (!etiquetas.length) return etiquetas;

        let filtered = [...etiquetas];

        // Aplicar filtro por fecha
        if (filtros.ultFechaMod && filtros.ultFechaMod !== "todos") {
            const now = new Date();
            let cutoffDate = new Date();

            switch (filtros.ultFechaMod) {
                case "1M":
                    cutoffDate.setMonth(now.getMonth() - 1);
                    break;
                case "3M":
                    cutoffDate.setMonth(now.getMonth() - 3);
                    break;
                case "6M":
                    cutoffDate.setMonth(now.getMonth() - 6);
                    break;
                case "1Y":
                    cutoffDate.setFullYear(now.getFullYear() - 1);
                    break;
                default:
                    break;
            }

            filtered = filtered.filter(etiqueta => {
                const updatedAt = new Date(etiqueta.updatedAt || etiqueta.createdAt);
                return updatedAt >= cutoffDate;
            });
        }

        // Aplicar filtro por colección
        if (filtros.coleccion && filtros.coleccion.length > 0) {
            filtered = filtered.filter(etiqueta => 
                filtros.coleccion.includes(etiqueta.COLECCION)
            );
        }

        // Aplicar filtro por sección
        if (filtros.seccion && filtros.seccion.length > 0) {
            filtered = filtered.filter(etiqueta => 
                filtros.seccion.includes(etiqueta.SECCION)
            );
        }

        return filtered;
    };

    // Efecto para aplicar filtros cuando cambian los filtros o el catálogo original
    useEffect(() => {
        if (filteredEtiquetasCatalogOriginal.length > 0) {
            const etiquetasFiltradas = applyFilters(filteredEtiquetasCatalogOriginal, filters);
            setFilteredEtiquetasCatalog(etiquetasFiltradas);
            
            // Si la etiqueta actualmente seleccionada no está en los resultados filtrados, limpiar la selección
            if (etiqueta && !etiquetasFiltradas.find(et => et.key === etiqueta)) {
                setEtiqueta("");
                setValor("");
                setFilteredValoresCatalog([]);
            }
        }
    }, [filters, filteredEtiquetasCatalogOriginal]);

    // Función para manejar la aplicación de filtros desde el modal
    const handleAplicarFiltros = (nuevosFiltros) => {
        setFilters(nuevosFiltros);
        setIsModalFiltroETOpen(false);
    };

    // Limpiar formulario cuando se cierra el modal
    useEffect(() => {
        if (!isModalOpen) {
            limpiarFormulario();
        }
    }, [isModalOpen]);

    // Función para obtener el texto a mostrar en los ComboBox
    const getDisplayText = (catalog, key) => {
        if (!key) return "";
        const item = catalog.find(item => item.key.toString() === key.toString());
        return item?.text || key;
    };

    const handleGuardar = async () => {
        setIsLoading(true);
        if (!sociedad || !cedis || !etiqueta || !valor || !grupoET || !id) {
            showToastMessage("❌ Completa Sociedad, CEDI, Etiqueta, Valor, Grupo Etiqueta y ID.");
            setIsLoading(false);
            return;
        }
        try {
            const registroActualizado = {
                IDSOCIEDAD: sociedad,
                IDCEDI: cedis,
                IDETIQUETA: etiqueta,
                IDVALOR: valor,
                INFOAD: infoAdicional,
                IDGRUPOET: grupoET,
                ID: id,
                ACTIVO: true,
            };

            const processType = "UpdateOne";
            const url = `${URL_BASE_BACKEND_CINNALOVERS}/api/security/gruposet/crud?ProcessType=${processType}&DBServer=${dbConnection}&LoggedUser=${LOGGED_USER}`;

            // Para editar necesitamos enviar tanto los datos originales como los nuevos
            const payload = {
                // Llaves del registro ORIGINAL para que el backend lo encuentre
                IDSOCIEDAD: registroEditar.sociedad,
                IDCEDI: registroEditar.sucursal,
                IDETIQUETA: registroEditar.etiqueta,
                IDVALOR: registroEditar.valor,
                IDGRUPOET: registroEditar.idgroup,
                ID: registroEditar.idg,
                // 'data' contiene todos los campos con sus NUEVOS valores
                data: registroActualizado
            };

            const res = await axios.post(url, payload, {
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (res.data?.success || res.status === 200) {
                limpiarFormulario();
                refetchData();
                handleCloseModal();
                showToastMessage(`✅ Registro actualizado correctamente`);
            } else {
                showToastMessage(`⚠️ Error al actualizar el registro`);
            }

        } catch (error) {
            if (error.response?.status === 409) {
                showToastMessage("❌ Ya existe un registro con esos datos. No se puede actualizar.");
            } else {
                console.error("❌ Error al guardar:", error);
                showToastMessage("Error al actualizar el registro: " + (error.response?.data?.message || error.message));
            }
        } finally {
            setIsLoading(false);
        }
    };

    const limpiarFormulario = () => {
        // No limpiar completamente, solo resetear a los valores del registro
        if (registroEditar) {
            setSociedad(registroEditar.sociedad || "");
            setCedis(registroEditar.sucursal || "");
            setEtiqueta(registroEditar.etiqueta || "");
            setValor(registroEditar.valor || "");
            setGrupoET(registroEditar.idgroup || "");
            setId(registroEditar.idg || "");
            setInfoAdicional(registroEditar.info || "");
        }
        
        // Resetear filtros
        setFilters({
            ultFechaMod: "todos",
            coleccion: [],
            seccion: [],
        });
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
                headerText="Editar registro"
                style={{
                    width: "450px",
                    maxWidth: "90vw"
                }}
                footer={
                    <Bar
                        endContent={
                            <>
                                <Button
                                    design={ButtonDesign.Emphasized}
                                    onClick={handleGuardar}
                                    className="btn-guardar-modal"
                                    loading={isLoading}
                                    disabled={isLoading}
                                    loadingText="Guardando..."
                                >
                                    Actualizar
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
                <div className="modal-content" style={{ padding: "1rem" }}>
                    <FlexBox
                        direction="Column"
                        style={{ gap: '1rem', width: '100%' }}
                    >
                        {/* Sociedad */}
                        <div>
                            <Label required>Sociedad:</Label>
                            <ComboBox
                                value={getDisplayText(sociedadesCatalog, sociedad)}
                                onSelectionChange={(e) => {
                                    const selectedItem = e.detail.item;
                                    const selectedKey = selectedItem?.dataset.key;
                                    console.log("Sociedad seleccionada:", selectedKey);
                                    setSociedad(selectedKey || "");
                                    // Limpiar selecciones dependientes
                                    setCedis("");
                                    setEtiqueta("");
                                    setValor("");
                                    setGrupoET("");
                                    // Resetear filtros
                                    setFilters({
                                        ultFechaMod: "todos",
                                        coleccion: [],
                                        seccion: [],
                                    });
                                    // Filtrar CEDIS - asegurar comparación de strings
                                    const filtered = cedisCatalog.filter(c =>
                                        c.parentSoc?.toString() === selectedKey?.toString()
                                    );
                                    console.log("CEDIS filtrados:", filtered);
                                    setFilteredCedisCatalog(filtered);
                                    setFilteredEtiquetasCatalog([]);
                                    setFilteredEtiquetasCatalogOriginal([]);
                                    setFilteredValoresCatalog([]);
                                }}
                                placeholder="Selecciona una sociedad"
                                filter="Contains"
                                style={{ width: '100%' }}
                            >
                                {sociedadesCatalog.map(item =>
                                    <ComboBoxItem
                                        key={item.key}
                                        data-key={item.key}
                                        text={item.text}
                                    />
                                )}
                            </ComboBox>
                        </div>

                        {/* CEDI */}
                        <div>
                            <Label required>CEDI:</Label>
                            <ComboBox
                                value={getDisplayText(filteredCedisCatalog, cedis)}
                                disabled={!sociedad || filteredCedisCatalog.length === 0}
                                onSelectionChange={(e) => {
                                    const selectedItem = e.detail.item;
                                    const selectedKey = selectedItem?.dataset.key;
                                    console.log("CEDI seleccionado:", selectedKey);
                                    setCedis(selectedKey || "");
                                    // Limpiar selecciones dependientes
                                    setEtiqueta("");
                                    setValor("");
                                    setGrupoET("");
                                    // Resetear filtros
                                    setFilters({
                                        ultFechaMod: "todos",
                                        coleccion: [],
                                        seccion: [],
                                    });
                                    // Filtrar Etiquetas - asegurar comparación de strings
                                    const filtered = etiquetasCatalog.filter(et =>
                                        et.IDSOCIEDAD?.toString() === sociedad?.toString() &&
                                        et.IDCEDI?.toString() === selectedKey?.toString()
                                    );
                                    console.log("Etiquetas filtradas:", filtered);
                                    setFilteredEtiquetasCatalog(filtered);
                                    setFilteredEtiquetasCatalogOriginal(filtered);
                                    setFilteredValoresCatalog([]);
                                }}
                                placeholder={filteredCedisCatalog.length === 0 ? "No hay CEDIS disponibles" : "Selecciona un CEDI"}
                                filter="Contains"
                                style={{ width: '100%' }}
                            >
                                {filteredCedisCatalog.map(item =>
                                    <ComboBoxItem
                                        key={item.key}
                                        data-key={item.key}
                                        text={item.text}
                                    />
                                )}
                            </ComboBox>
                        </div>

                        {/* Etiqueta */}
                        <div>
                            <Label required>Etiqueta:</Label>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <ComboBox
                                    value={getDisplayText(filteredEtiquetasCatalog, etiqueta)}
                                    disabled={!cedis || filteredEtiquetasCatalog.length === 0}
                                    onSelectionChange={(e) => {
                                        const selectedItem = e.detail.item;
                                        const selectedKey = selectedItem?.dataset.key;
                                        console.log("Etiqueta seleccionada:", selectedKey);
                                        setEtiqueta(selectedKey || "");
                                        // Limpiar selección dependiente
                                        setValor("");
                                        setGrupoET("");
                                        // Filtrar Valores
                                        const filtered = valoresCatalog.filter(v =>
                                            v.parentEtiqueta === selectedKey
                                        );
                                        console.log("Valores filtrados:", filtered);
                                        setFilteredValoresCatalog(filtered);
                                    }}
                                    placeholder={
                                        filteredEtiquetasCatalog.length === 0 
                                            ? "No hay etiquetas disponibles" 
                                            : `Etiquetas (${filteredEtiquetasCatalog.length})`
                                    }
                                    filter="Contains"
                                    style={{ width: '100%' }}
                                >
                                    {filteredEtiquetasCatalog.map(item =>
                                        <ComboBoxItem
                                            key={item.key}
                                            data-key={item.key}
                                            text={item.text}
                                        />
                                    )}
                                </ComboBox>
                                <Button
                                    icon="filter"
                                    design="Transparent"
                                    onClick={() => setIsModalFiltroETOpen(true)}
                                    disabled={!sociedad || !cedis}
                                    title="Filtrar etiquetas"
                                />
                            </div>
                        </div>

                        {/* Valor */}
                        <div>
                            <Label required>Valor:</Label>
                            <ComboBox
                                value={getDisplayText(filteredValoresCatalog, valor)}
                                disabled={!etiqueta || filteredValoresCatalog.length === 0}
                                onSelectionChange={(e) => {
                                    const selectedItem = e.detail.item;
                                    const selectedKey = selectedItem?.dataset.key;
                                    console.log("Valor seleccionado:", selectedKey);
                                    setValor(selectedKey || "");
                                }}
                                placeholder={filteredValoresCatalog.length === 0 ? "No hay valores disponibles" : "Selecciona un valor"}
                                filter="Contains"
                                style={{ width: '100%' }}
                            >
                                {filteredValoresCatalog.map(item =>
                                    <ComboBoxItem
                                        key={item.key}
                                        data-key={item.key}
                                        text={item.text || item.key}
                                    />
                                )}
                            </ComboBox>
                        </div>

                        {/* Grupo ET */}
                        <div>
                            <Label required>Grupo ET:</Label>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <Input
                                    value={grupoET}
                                    onChange={(e) => setGrupoET(e.target.value)}
                                    placeholder="Grupo ET"
                                    style={{ flex: 1 }}
                                    disabled={true}
                                />
                                <Button
                                    icon="edit"
                                    design="Transparent"
                                    onClick={() => setIsModalEditGrupoETOpen(true)}
                                    disabled={!sociedad || !cedis}
                                    title="Generar Grupo ET"
                                />
                            </div>
                        </div>

                        {/* ID */}
                        <div>
                            <Label required>ID:</Label>
                            <Input
                                value={id}
                                onChange={(e) => setId(e.target.value)}
                                placeholder="ID del grupo"
                                style={{ width: '100%' }}
                            />
                        </div>

                        {/* Información adicional */}
                        <div>
                            <Label>Información adicional:</Label>
                            <TextArea
                                value={infoAdicional}
                                onChange={(e) => setInfoAdicional(e.target.value)}
                                placeholder="Información adicional..."
                                style={{ width: '100%', minHeight: '80px' }}
                                growing
                                growingMaxLines={5}
                            />
                        </div>
                    </FlexBox>
                </div>
            </Dialog>

            {isModalFiltroETOpen && (
                <ModalFiltroET
                    isModalOpen={isModalFiltroETOpen}
                    handleCloseModal={() => setIsModalFiltroETOpen(false)}
                    handleAplicarFiltros={handleAplicarFiltros}
                    etiquetasCatalog={filteredEtiquetasCatalogOriginal}
                    currentFilters={filters}
                />
            )}

            {isModalEditGrupoETOpen && (
                <ModalEditGrupoET
                    isModalOpen={isModalEditGrupoETOpen}
                    handleCloseModal={() => setIsModalEditGrupoETOpen(false)}
                    setGrupoET={setGrupoET}
                    etiquetas={etiquetasCatalog}
                    valores={valoresCatalog}
                    sociedadSeleccionada={sociedad}
                    cediSeleccionado={cedis}
                />
            )}

        </>
    );
}

export default ModalEditar;
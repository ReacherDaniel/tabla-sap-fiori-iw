import React, { useEffect, useState } from "react";
import "./css/App.css";
import "./css/Modal.css";
import axios from "axios";
import {
  ShellBar,
  Button,
  Input,
  AnalyticalTable,
  Dialog,
  Bar,
  Label,
  ComboBox,
  ComboBoxItem,
  TextArea,
  FlexBox,
  SideNavigation,
  SideNavigationItem,
  SideNavigationSubItem,
  Switch,
  Table,
  TableRow,
  TableCell,
  TableRowAction,
  TableRowActionNavigation,
  TableHeaderRow,
  TableHeaderCell,
  TableHeaderCellActionAI,
  TableGrowing,
  TableSelection,
  TableVirtualizer,
  TableSelectionMulti,
  TableSelectionSingle,
  Icon
} from "@ui5/webcomponents-react";
import ModalCrear from "../components/ModalCrear";
import ModalEditGrupoET from "../components/ModalEditGrupoET.jsx";
import "@ui5/webcomponents-icons/dist/menu.js";
import "@ui5/webcomponents-icons/dist/home.js";
import "@ui5/webcomponents-icons/dist/settings.js";
import "@ui5/webcomponents-icons/dist/database.js";
// Importacion de iconos
import "@ui5/webcomponents-icons/dist/edit.js";
import "@ui5/webcomponents-icons/dist/accept.js";
import "@ui5/webcomponents-icons/dist/decline.js";
import "@ui5/webcomponents-icons/dist/navigation-down-arrow.js";
import "@ui5/webcomponents-icons/dist/navigation-up-arrow.js";

const URL_BASE = "https://app-restful-sap-cds.onrender.com"; // http://localhost:4004
const URL_BASE_BACKEND_MIGUEL = "http://localhost:3034";

export default function App() {
  // --- Estados originales ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRow, setSelectedRow] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [editingRowData, setEditingRowData] = useState(null);
  const [originalRowData, setOriginalRowData] = useState(null);

  // --- Estados añadidos del menú ---
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [dbConnection, setDbConnection] = useState("MongoDB");
  const [dbPost, setDbPost] = useState("MongoDB");

  // --- Estados para ComboBoxes en cascada de la fila expandida ---
  const [sociedadesCatalog, setSociedadesCatalog] = useState([]);
  const [cedisCatalog, setCedisCatalog] = useState([]);
  const [etiquetasCatalog, setEtiquetasCatalog] = useState([]);
  const [valoresCatalog, setValoresCatalog] = useState([]);

  // Estados para los catálogos filtrados
  const [filteredCedisCatalog, setFilteredCedisCatalog] = useState([]);
  const [filteredEtiquetasCatalog, setFilteredEtiquetasCatalog] = useState([]);
  const [filteredValoresCatalog, setFilteredValoresCatalog] = useState([]);

  // --- Cambio de conexión ---
  const handleSwitchChange = () => {
    setDbConnection(dbConnection === "MongoDB" ? "Azure" : "MongoDB");
  };
  const CambioDbPost = () => {
    setDbPost(dbPost === "MongoDB" ? "Azure" : "MongoDB");
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.post(
        `${URL_BASE}/api/security/gruposet/crud?ProcessType=GetAll&DBServer=${dbConnection}`,
        {}
      );

      //console.log("SERVER RESPONSE ==============> ",res.data?.data?.[0]?.dataRes);

      const records =
        res.data?.data?.[0]?.dataRes?.map((item) => ({
          sociedad: item.IDSOCIEDAD,
          sucursal: item.IDCEDI,
          etiqueta: item.IDETIQUETA,
          valor: item.IDVALOR,
          idgroup: item.IDGRUPOET,
          idg: item.ID,
          info: item.INFOAD,
          registro: `${item.FECHAREG} ${item.HORAREG} (${item.USUARIOREG})`,
          ultMod: !item.FECHAULTMOD ? "Sin modificaciones" : `${item.FECHAULTMOD} ${item.HORAULTMOD} (${item.USUARIOMOD})`,
          estado: item.ACTIVO,
        })) || [];

      //console.log("Datos obtenidos:", records);

      setData(records);
    } catch (error) {
      console.error("Error al obtener datos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchCatalogos = async () => {
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
  }, [dbConnection]);

  // Cargar datos del backend
  useEffect(() => {
    fetchData();
  }, [dbConnection]);

  const columns = [
    { Header: "", accessor: "expand" },
    { Header: "Sociedad", accessor: "sociedad" },
    { Header: "Sucursal (CEDIS)", accessor: "sucursal" },
    { Header: "Etiqueta", accessor: "etiqueta" },
    { Header: "Valor", accessor: "valor" },
    { Header: "Grupo Etiqueta", accessor: "idgroup" },
    { Header: "ID", accessor: "idg" },
    { Header: "Información adicional", accessor: "info" },
    { Header: "Registro", accessor: "registro" },
    { Header: "Última modificación", accessor: "ultMod" },
    { Header: "Estado", accessor: "estado" },
  ];

  const cerrarModalCreacion = () => setIsModalOpen(false);

  const handleGuardarCambiosEdicion = async (editedData, originalData) => {
    if (!editedData.sociedad || !editedData.sucursal || !editedData.etiqueta || !editedData.valor || !editedData.idgroup || !editedData.idg) {
      alert("Completa Sociedad, CEDI, Etiqueta, Valor, Grupo Etiqueta y ID.");
      return;
    }
    try {
      const url = `${URL_BASE}/api/security/gruposet/crud?ProcessType=UpdateOne&DBServer=${dbConnection}&LoggedUser=FMIRANDAJ`;

      const payload = {
        // Llaves del registro ORIGINAL para que el backend lo encuentre
        IDSOCIEDAD: originalData.sociedad,
        IDCEDI: originalData.sucursal,
        IDETIQUETA: originalData.etiqueta,
        IDVALOR: originalData.valor,
        IDGRUPOET: originalData.idgroup,
        ID: originalData.idg,
        // 'data' contiene todos los campos con sus NUEVOS valores
        data: {
          IDSOCIEDAD: editedData.sociedad,
          IDCEDI: editedData.sucursal,
          IDETIQUETA: editedData.etiqueta,
          IDVALOR: editedData.valor,
          IDGRUPOET: editedData.idgroup,
          ID: editedData.idg,
          INFOAD: editedData.info,
          ACTIVO: editedData.estado !== false,
          BORRADO: editedData.estado || false
        }
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      console.log("Payload enviado a UpdateOne:", payload);

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409) {
          alert("❌ Ya existe un registro con esa llave compuesta. No se puede actualizar.");
          return;
        }
        // Para otros errores, lanzamos una excepción para que la capture el catch.
        throw new Error("Error HTTP " + res.status + (json.messageUSR ? " - " + json.messageUSR : ""));
      }

      alert("✅ Cambios guardados correctamente");

      // 🔄 Refrescar tabl
      fetchData();
    } catch (error) {
      console.error("Error al guardar cambios:", error);
      alert("❌ No se pudieron guardar los cambios");
    }

  }

  const handleActivar = async () => {
    // Verificar si hay una fila seleccionada
    if (!selectedRow) {
      alert("⚠️ Selecciona un registro de la tabla primero");
      return;
    }

    try {
      const url = `${URL_BASE}/api/security/gruposet/crud?ProcessType=UpdateOne&DBServer=${dbConnection}&LoggedUser=FMIRANDAJ`;

      const payload = {
        // Llaves para identificar el registro
        IDSOCIEDAD: selectedRow.sociedad,
        IDCEDI: selectedRow.sucursal,
        IDETIQUETA: selectedRow.etiqueta,
        IDVALOR: selectedRow.valor,
        IDGRUPOET: selectedRow.idgroup,
        ID: selectedRow.idg,
        // Datos a actualizar
        data: {
          ACTIVO: true,
          BORRADO: false
        }
      };

      console.log("📤 Activando registro:", payload);

      const response = await axios.post(url, payload);

      console.log("📥 Respuesta:", response.data);

      alert("✅ Registro activado correctamente");

      // 🔄 Refrescar la tabla
      fetchData();

    } catch (err) {
      console.error("❌ Error al activar:", err);
      console.error("❌ Detalles:", err.response?.data);
      alert(`❌ No se pudo activar: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleDesactivar = async () => {
    if (!selectedRow) { alert("Selecciona un registro"); return; }

    try {
      const payload = {
        IDSOCIEDAD: selectedRow.sociedad,
        IDCEDI: selectedRow.sucursal,
        IDETIQUETA: selectedRow.etiqueta,
        IDVALOR: selectedRow.valor,
        IDGRUPOET: selectedRow.idgroup,
        ID: selectedRow.idg
      };

      const url = `${URL_BASE}/api/security/gruposet/crud?ProcessType=DeleteOne&DBServer=${dbConnection}`;
      await axios.post(url, payload);

      alert("🟡 Registro desactivado");
      // 🔄 Refrescar tabla
      fetchData();

    } catch (err) {
      console.error("Error al desactivar:", err);
      alert("❌ No se pudo desactivar el registro");
    }
  };

  const handleEliminarClick = async () => {
    if (!selectedRow) { alert("Selecciona un registro"); return; }

    try {
      const payload = {
        IDSOCIEDAD: selectedRow.sociedad,
        IDCEDI: selectedRow.sucursal,
        IDETIQUETA: selectedRow.etiqueta,
        IDVALOR: selectedRow.valor,
        IDGRUPOET: selectedRow.idgroup,
        ID: selectedRow.idg
      };

      const url = `${URL_BASE}/api/security/gruposet/crud?ProcessType=DeleteHard&DBServer=${dbConnection}`;
      await axios.post(url, payload);

      alert("🟡 Registro eliminado con éxito");
      // 🔄 Refrescar tabla
      fetchData();

    } catch (err) {
      console.error("Error al eliminar :", err);
      alert("❌ No se pudo eliminar el registro");
    }
  };

  //console.log("Registros cargados:", data.length, data);

  const handleRowClick = (row) => {
    // Si la fila clickeada es la misma que ya está seleccionada, deseleccionar
    if (selectedRow === row) {
      setSelectedRow(null);
    } else {
      // Si no, seleccionar la nueva fila
      setSelectedRow(row);
    }
  };

  const handleToggleExpand = (rowId) => {
    const newExpandedRowId = expandedRowId === rowId ? null : rowId;
    setExpandedRowId(newExpandedRowId);

    if (newExpandedRowId) {
      // Cuando una fila se expande, inicializamos los datos de edición
      const rowData = data.find(row => row.idg === rowId);
      setEditingRowData(rowData);
      setOriginalRowData(rowData); // Guardamos la copia original

      // Pre-filtrar los catálogos basados en los datos de la fila que se expande
      if (rowData) {
        const cedis = cedisCatalog.filter(c => c.parentSoc.toString() === rowData.sociedad.toString());
        setFilteredCedisCatalog(cedis);

        const etiquetas = etiquetasCatalog.filter(et => et.IDSOCIEDAD?.toString() === rowData.sociedad.toString() && et.IDCEDI?.toString() === rowData.sucursal.toString());
        setFilteredEtiquetasCatalog(etiquetas);

        const valores = valoresCatalog.filter(v => v.parentEtiqueta === rowData.etiqueta);
        setFilteredValoresCatalog(valores);
      }

    } else {
      // Cuando se colapsa, limpiamos los datos de edición
      setEditingRowData(null);
      setOriginalRowData(null);
    }
  };

  // Maneja los cambios en los inputs de la fila expandida
  const handleEditInputChange = (e) => {
    // Para ComboBox, el valor está en detail.item.text
    const name = e.target.name;
    const value = e.detail?.item?.text ?? e.target.value;

    setEditingRowData(prev => {
      const newState = { ...prev, [name]: value };
      // Limpiar campos dependientes al cambiar uno de la cascada
      if (name === 'sociedad') {
        newState.sucursal = '';
        newState.etiqueta = '';
        newState.valor = '';
      } else if (name === 'sucursal') {
        newState.etiqueta = '';
        newState.valor = '';
      } else if (name === 'etiqueta') {
        newState.valor = '';
      }
      return newState;
    });
  };

  const [isEditGrupoETModalOpen, setIsEditGrupoETModalOpen] = useState(false);

  return (
    <>
      {/* 🔹 ShellBar con menú hamburguesa */}
      <ShellBar
        primaryTitle="CINNALOVERS"
        startButton={
          <Button
            icon="menu"
            design="Transparent"
            onClick={() => setIsNavOpen(!isNavOpen)}
          />
        }
        showNotifications
        showCoPilot
        showProductSwitch
      />

      {/* 🔹 Menú lateral (SideNavigation) */}
      {isNavOpen && (
        <SideNavigation
          style={{
            width: "250px",
            height: "100vh",
            position: "fixed",
            top: "45px",
            left: 0,
            backgroundColor: "#f7f7f7",
            boxShadow: "2px 0 5px rgba(0,0,0,0.1)",
            zIndex: 1000,
          }}
        >
          <SideNavigationItem icon="home" text="Inicio" />
          <SideNavigationItem
            icon="database"
            text="Grupos de SKU"
            selected
          />
          <SideNavigationItem
            icon="settings"
            text="Configuración"
            onClick={() => setShowConfig(true)}
          />
        </SideNavigation>
      )}

      {/* 🔹 Contenido original sin modificar */}
      <div
        className="container-principal"
        style={{
          marginLeft: isNavOpen ? "260px" : "0",
          transition: "margin-left 0.3s ease",
        }}
      >
        <h2 className="titulo">Grupos y subgrupos de SKU</h2>

        <div className="barra-controles">
          <Button
            className="btn-crear"
            icon="add"
            onClick={() => setIsModalOpen(true)}
          >
            Crear
          </Button>
          {/* <Button
            className="btn-editar"
            icon="edit"
            onClick={handleEditarClick}
            disabled={true}
          >
            Editar
          </Button> */}
          <Button
            className="btn-eliminar"
            icon="delete"
            onClick={handleEliminarClick}
            disabled={!selectedRow}
          >
            Eliminar
          </Button>
          <Button
            className="btn-desactivar"
            icon="decline"
            onClick={handleDesactivar}
            disabled={!selectedRow || !selectedRow.estado}
          >
            Desactivar
          </Button>
          <Button
            className="btn-activar"
            icon="accept"
            onClick={handleActivar}
            disabled={!selectedRow || selectedRow.estado}
          >
            Activar
          </Button>
          <div className="search-bar">
            <Input
              placeholder="Buscar..."
              icon="search"
              className="search-input"
            />
          </div>
        </div>

        <div className="tabla-fondo" style={{ cursor: "pointer" }}>
          {loading ? (
            <p className="loading-msg">Cargando datos...</p>
          ) : data.length > 0 ? (
            <Table
              headerRow={
                <TableHeaderRow sticky>
                  {columns.map((column, index) => (
                    <TableHeaderCell key={index}>{column.Header}</TableHeaderCell>
                  ))}
                </TableHeaderRow>
              }
              onRowClick={(ev) => {
                const r = ev?.row?.original ?? ev?.detail?.row?.original ?? null;
                if (r) setSelectedRow(r);
              }}
            >
              {data.map((row) => {
                const isExpanded = expandedRowId === row.idg;
                return (
                  <React.Fragment key={row.idg}>
                    <TableRow
                      selected={selectedRow === row}
                      onClick={() => handleRowClick(row)}
                    >
                      <TableCell>
                        <Button
                          icon={isExpanded ? "navigation-up-arrow" : "navigation-down-arrow"}
                          design="Transparent"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleExpand(row.idg);
                          }}
                        />
                      </TableCell>
                      <TableCell><span>{row.sociedad}</span></TableCell>
                      <TableCell><span>{row.sucursal}</span></TableCell>
                      <TableCell><span>{row.etiqueta}</span></TableCell>
                      <TableCell><span>{row.valor}</span></TableCell>
                      <TableCell><span>{row.idgroup}</span></TableCell>
                      <TableCell><span>{row.idg}</span></TableCell>
                      <TableCell><span>{row.info}</span></TableCell>
                      <TableCell><span>{row.registro}</span></TableCell>
                      <TableCell><span>{row.ultMod}</span></TableCell>
                      <TableCell>
                        {row.estado ? (
                          <Icon name="accept" style={{ color: "green" }} title="Activo" />
                        ) : (
                          <Icon name="decline" style={{ color: "red" }} title="Inactivo" />
                        )}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="expanded-row">
                        {/* Celda vacía para el botón de expandir */}
                        <TableCell />
                        <TableCell>
                          <ComboBox
                            className="modal-combobox"
                            value={`Sociedad ${editingRowData.sociedad}`}
                            onSelectionChange={(e) => {
                              const selectedItem = e.detail.item;
                              const selectedKey = selectedItem?.dataset.key;
                              setEditingRowData(prev => ({
                                ...prev,
                                sociedad: selectedKey,
                                // Limpiar selecciones dependientes
                                sucursal: "",
                                etiqueta: "",
                                valor: "",
                              }));

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
                        </TableCell>
                        <TableCell>
                          <ComboBox
                            className="modal-combobox"
                            value={`Cedi ${editingRowData.sucursal}`}
                            disabled={!editingRowData.sociedad}
                            onSelectionChange={(e) => {
                              const selectedItem = e.detail.item;
                              const selectedKey = selectedItem?.dataset.key;
                              setEditingRowData(prev => ({
                                ...prev,
                                sucursal: selectedKey,
                                // limpiar selecciones dependientes
                                etiqueta: "",
                                valor: "",
                              }));

                              setFilteredEtiquetasCatalog([]);
                              setFilteredValoresCatalog([]);
                              // Filtrar Etiquetas
                              const filtered = etiquetasCatalog.filter(et => et.IDSOCIEDAD?.toString() === editingRowData.sociedad.toString() && et.IDCEDI?.toString() === selectedKey);
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
                        </TableCell>
                        <TableCell>
                          <ComboBox
                            className="modal-combobox"
                            value={editingRowData.etiqueta}
                            disabled={!editingRowData.sucursal}
                            onSelectionChange={(e) => {
                              const selectedItem = e.detail.item;
                              const selectedKey = selectedItem?.dataset.key;
                              setEditingRowData(prev => ({
                                ...prev,
                                etiqueta: selectedKey,
                                // Limpiar selección dependiente
                                valor: "",
                              }));

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
                        </TableCell>
                        <TableCell>
                          <ComboBox
                            className="modal-combobox"
                            value={editingRowData.valor}
                            disabled={!editingRowData.etiqueta}
                            onSelectionChange={(e) => {
                              const selectedItem = e.detail.item;
                              const selectedKey = selectedItem?.dataset.key;
                              setEditingRowData(prev => ({ ...prev, valor: selectedKey }));
                            }}
                            placeholder="Seleccione un valor"
                            filter="Contains"
                            style={{ width: '400px' }}
                          >
                            {filteredValoresCatalog.map(item =>
                              <ComboBoxItem key={item.key} data-key={item.key} text={item.text} />
                            )}
                          </ComboBox>
                        </TableCell>
                        <TableCell>
                          <FlexBox direction="Column" style={{ gap: '0.5rem' }}>
                            <Input name="idgroup" value={editingRowData?.idgroup || ''} disabled style={{ width: '100%' }} />
                            <Button
                              icon="edit"
                              design="Transparent"
                              onClick={() => setIsEditGrupoETModalOpen(true)}
                              disabled={!editingRowData?.sociedad || !editingRowData?.sucursal}
                              title="Editar Grupo ET"
                              style={{ alignSelf: 'flex-start' }}
                            />
                          </FlexBox>
                        </TableCell>
                        <TableCell>
                          <Input name="idg" value={editingRowData?.idg || ''} onInput={handleEditInputChange} />
                        </TableCell>
                        <TableCell>
                          <Input name="info" value={editingRowData?.info || ''} onInput={handleEditInputChange} />
                        </TableCell>
                        <TableCell>
                          {/* El registro generalmente no es editable */}
                          <span>{row.registro}</span>
                        </TableCell>
                        <TableCell>
                          {/* La última modificación no es editable */}
                          <span>{row.ultMod}</span>
                        </TableCell>
                        <TableCell>
                          <FlexBox direction="Column" style={{ gap: '0.5rem' }}>
                            <Button
                              icon="accept"
                              design="Positive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleGuardarCambiosEdicion(editingRowData, originalRowData);
                                setExpandedRowId(null); // Cierra la fila después de guardar
                              }}
                            >
                              Guardar
                            </Button>
                            <Button
                              icon="decline"
                              design="Negative"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedRowId(null); // Simplemente cierra la fila
                                setEditingRowData(null);
                              }}
                            >
                              Cancelar
                            </Button>
                          </FlexBox>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </Table>
          ) : (
            <p className="no-data-msg">No hay datos disponibles</p>
          )}
        </div>
      </div>

      {/* Modal */}
      <ModalCrear
        isModalOpen={isModalOpen}
        handleCloseModal={cerrarModalCreacion}
        dbConnection={dbConnection}
        refetchData={fetchData}
      />

      {/* Modal para editar Grupo ET en la fila */}
      <ModalEditGrupoET
        isModalOpen={isEditGrupoETModalOpen}
        handleCloseModal={() => setIsEditGrupoETModalOpen(false)}
        setGrupoET={(newGrupoET) => {
          setEditingRowData(prev => ({ ...prev, idgroup: newGrupoET }));
        }}
        etiquetas={etiquetasCatalog} // Pasamos el catálogo completo
        valores={valoresCatalog}
        sociedadSeleccionada={editingRowData?.sociedad}
        cediSeleccionado={editingRowData?.sucursal}
      />




      {/* 🔹 Ventana de configuración para cambiar server de BD */}
      {showConfig && (
        <Dialog
          headerText="Configuración"
          open={showConfig}
          onAfterClose={() => setShowConfig(false)}
          footer={
            <Button design="Emphasized" onClick={() => setShowConfig(false)}>
              Cerrar
            </Button>
          }
        >
          <FlexBox direction="Column" style={{ padding: "1rem" }}>
            <Label>Conexión a base de datos</Label>
            <FlexBox alignItems="Center" justifyContent="SpaceBetween">
              <Label>{dbConnection}</Label>
              <Switch
                textOn="Cosmos"
                textOff="MongoDB"
                checked={dbConnection === "Azure Cosmos"}
                onChange={handleSwitchChange}
              />
            </FlexBox>
          </FlexBox>
        </Dialog>
      )}
    </>
  );
}

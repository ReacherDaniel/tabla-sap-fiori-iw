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
import "@ui5/webcomponents-icons/dist/menu.js";
import "@ui5/webcomponents-icons/dist/home.js";
import "@ui5/webcomponents-icons/dist/settings.js";
import "@ui5/webcomponents-icons/dist/database.js";
// Importacion de iconos
import "@ui5/webcomponents-icons/dist/accept.js";
import "@ui5/webcomponents-icons/dist/decline.js";

const URL_BASE = "https://app-restful-sap-cds.onrender.com"; // http://localhost:4004

export default function App() {
  // --- Estados originales ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRow, setSelectedRow] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // --- Estados añadidos del menú ---
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [dbConnection, setDbConnection] = useState("MongoDB");
  const [dbPost, setDbPost] = useState("MongoDB");

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

  // Cargar datos del backend
  useEffect(() => {

    fetchData();
  }, [dbConnection]);

  const columns = [
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

  const handleEditarClick = () => {
    if (!selectedRow) {
      alert("Selecciona una fila primero");
      return;
    }

    // Cargar los datos seleccionados al modal
    setSociedad(selectedRow.sociedad || "");
    setSucursal(selectedRow.sucursal || "");
    setEtiqueta(selectedRow.etiqueta || "");
    setIdValor(selectedRow.valor || "");
    setInfoAdicional(selectedRow.info || "");
    setidGroupEt(selectedRow.idgroup || "");
    setid(selectedRow.idg || "");

    setIsEditing(true);
    setIsModalOpen(true);

  };


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

      alert("🟡 Registro elimina");
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
          <Button
            className="btn-editar"
            icon="edit"
            onClick={handleEditarClick}
            disabled={!selectedRow}
          >
            Editar
          </Button>
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
              {data.map((row, index) => (
                <TableRow
                  key={index}
                  selected={selectedRow === row}
                  onClick={() => handleRowClick(row)}
                >
                  <TableCell>
                    <span>{row.sociedad}</span>
                  </TableCell>
                  <TableCell>
                    <span>{row.sucursal}</span>
                  </TableCell>
                  <TableCell>
                    <span>{row.etiqueta}</span>
                  </TableCell>
                  <TableCell>
                    <span>{row.valor}</span>
                  </TableCell>
                  <TableCell>
                    <span>{row.idgroup}</span>
                  </TableCell>
                  <TableCell>
                    <span>{row.idg}</span>
                  </TableCell>
                  <TableCell>
                    <span>{row.info}</span>
                  </TableCell>
                  <TableCell>
                    <span>{row.registro}</span>
                  </TableCell>
                  <TableCell>
                    <span>{row.ultMod}</span>
                  </TableCell>
                  <TableCell>
                    {row.estado ? (
                      <Icon
                        name="accept"
                        style={{ color: "green" }}
                        title="Activo"
                      />
                    ) : (
                      <Icon
                        name="decline"
                        style={{ color: "red" }}
                        title="Inactivo"
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
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

      {/* 🔹 Ventana de configuración (nueva) */}
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

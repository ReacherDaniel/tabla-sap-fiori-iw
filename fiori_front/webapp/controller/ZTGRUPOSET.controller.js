sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/Dialog",
  "sap/m/Button",
  "sap/m/library",
  "sap/m/MessageBox",
  "sap/m/MessageToast",
  "sap/m/Text",
  "sap/ui/core/Fragment",
  "sap/m/ComboBox",        
  "sap/ui/core/Item"
], (Controller, JSONModel, Filter, FilterOperator, Dialog, Button, library, MessageBox, MessageToast, Text, Fragment,ComboBox,CoreItem  ) => {
  "use strict";

  const ButtonType = library.ButtonType;

  return Controller.extend("com.itt.ztgruposet.frontendztgruposet.controller.ZTGRUPOSET", {

    formatter: {
      truncateInfoAd: function (sInfo) {
        if (!sInfo) {
          return "";
        }
        const aWords = sInfo.split(" ");
        if (aWords.length > 3) {
          return aWords.slice(0, 3).join(" ") + "...";
        }
        return sInfo;
      }
    },

     _inlineOriginal: null,   

     
    // 🔎 estado de filtros
    _sSearchQuery: "",
    _sQuickFilterKey: "ALL",
    _oAdvancedFilter: null,

    onAvatarPressed: function () {
      MessageToast.show("Avatar pressed!");
    },

    onLogoPressed: function () {
      MessageToast.show("Logo pressed!");
    },

    
    _oFilterDialog: null,
    onInit() {

       // 1) Modelo para saber qué servidor de BD está activo
      var oConfigModel = new sap.ui.model.json.JSONModel({
          dbServer: "mongo" // valor inicial: "mongo" o lo que tengas por default
      });
      this.getView().setModel(oConfigModel, "config");

      // Modelos existentes
      this.getView().setModel(new JSONModel({}), "updateModel");
      this.getView().setModel(new JSONModel({}), "createModel");
      this.getView().setModel(new JSONModel({ state: false }), "dbServerSwitch");
      this.getView().setModel(new JSONModel({ text: "" }), "infoAd");

      // Modelo del diálogo de filtros globales (ya existía)
      this._initFilterModel();

      // 👉 Modelo del modal de filtros de ETIQUETAS
      this.getView().setModel(new JSONModel({
        selectedDateRange: "ALL",
        colecciones: [],
        secciones: []
      }), "etiquetaFilterModel");

      // Modelo para cascadas
      this.getView().setModel(new JSONModel({
        fullData: [],
        sociedades: [],
        cedis: [],
        etiquetas: [],
        valores: []
      }), "cascadeModel");

      this.getView().setModel(new JSONModel({
        selectedEtiqueta: null,
        selectedValor: null,
        valoresList: [],
        display: ""
      }), "grupoEtModel");

      this._aCatalogData = [];

      // Propiedades de paginación
      this._aAllItems = [];
      this._aFilteredItems = [];
      this._iCurrentPage = 1;
      this._iPageSize = 10;

      this._aCatalogData = [];

      // 👉 Modelo para la edición inline (borrador temporal)
      this.getView().setModel(new JSONModel({
        current: {}
      }), "inlineEdit");

      this._loadExternalCatalogData().then(() => {
        this._bCatalogLoaded = true;
      });

      // Carga de la tabla inicial
      this._loadData();
    },

        
     //Devuelve la URL base según la BD seleccionada en el switch.
     
    _getBaseUrl: function () {
        var sDb = this.getView().getModel("config").getProperty("/dbServer");

        if (sDb === "azure") {
            return "/api/azure";      
        } else {
            return "/api/mongo";      
        }
    },


    _initFilterModel: function () {
      const oFilterModel = new JSONModel({
        searchQuery: "",
        fields: [
          { key: "IDSOCIEDAD", text: "Sociedad" },
          { key: "IDCEDI", text: "Sucursal (CEDIS)" },
          { key: "IDETIQUETA", text: "Etiqueta" },
          { key: "IDVALOR", text: "Valor" },
          { key: "IDGRUPOET", text: "Grupo Etiqueta" },
          { key: "ID", text: "ID" }
        ],
        selectedField: "IDETIQUETA", // Campo por defecto para buscar
        selectedFieldIndex: 2, // Índice de "IDETIQUETA"
        sort: {
          fields: [
            { key: "ID", text: "ID" },
            { key: "IDSOCIEDAD", text: "Sociedad" },
            { key: "IDCEDI", text: "Sucursal (CEDIS)" },
            { key: "IDETIQUETA", text: "Etiqueta" },
            { key: "IDGRUPOET", text: "Grupo Etiqueta" },
            { key: "FECHAREG", text: "Fecha de Registro" },
            { key: "FECHAULTMOD", text: "Fecha Última Modificación" },
            { key: "ACTIVO", text: "Estado" }
          ],
          selectedField: "ID", // Campo por defecto para ordenar
          direction: "ASC"
        }
      });
      this.getView().setModel(oFilterModel, "filter");
    },

     // ==== CARGA DE DATOS DESDE CAP/CDS (POST) ====
    _loadData: async function () {
      const oView = this.getView();
      oView.setBusy(true);
      try {
        // Usa el proxy del ui5.yaml: /api -> http://localhost:4004
        const url = this._getApiParams("GetAll");

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({})
        });
        if (!res.ok) throw new Error("HTTP " + res.status);

        const json = await res.json();

        // Los registros vienen en data[0].dataRes
        const items = (((json || {}).data || [])[0] || {}).dataRes || [];

        // =========================
        // 1) Catálogos del cascadeModel
        // =========================
        const oCascadeModel  = this.getView().getModel("cascadeModel") || new JSONModel({});
        const aEtiquetasAll  = oCascadeModel.getProperty("/etiquetasAll")  || [];
        const aValoresAll    = oCascadeModel.getProperty("/valoresAll")    || [];
        const aSociedades    = oCascadeModel.getProperty("/sociedades")    || [];
        const aCedisAll      = oCascadeModel.getProperty("/cedisAll")      || [];

        // =========================
        // 2) Normalizar y enriquecer registros
        // =========================
        const normalized = items.map(x => {
          // --- Buscar ETIQUETA en catálogo ---
          const oMatch = aEtiquetasAll.find(e =>
            String(e.IDSOCIEDAD) === String(x.IDSOCIEDAD) &&
            String(e.IDCEDI)     === String(x.IDCEDI) &&
            String(e.IDETIQUETA) === String(x.IDETIQUETA)
          );

          // --- Buscar VALOR en catálogo ---
          const oValorMatch = aValoresAll.find(v =>
            String(v.IDSOCIEDAD)     === String(x.IDSOCIEDAD) &&
            String(v.IDCEDI)         === String(x.IDCEDI) &&
            String(v.parentEtiqueta) === String(x.IDETIQUETA) &&
            String(v.IDVALOR)        === String(x.IDVALOR)
          );

          // --- Buscar SOCIEDAD en catálogo ---
          const oSocMatch = aSociedades.find(s =>
            String(s.key) === String(x.IDSOCIEDAD)
          );

          // --- Buscar CEDI en catálogo (por sociedad + cedi) ---
          const oCediMatch = aCedisAll.find(c =>
            String(c.key)       === String(x.IDCEDI) &&
            String(c.parentSoc) === String(x.IDSOCIEDAD)
          );

          // Texto amigable de ETIQUETA
         const sEtiquetaTxt =
          (oMatch && oMatch.text) ||
          x.ALIAS ||
          x.IDETIQUETA;

          // Texto amigable de VALOR
          const sValorTxt =
            (oValorMatch && oValorMatch.text && String(oValorMatch.text).trim()) ||
            x.IDVALOR;

          // Texto amigable de SOCIEDAD y CEDI
          const sSociedadTxt = oSocMatch  ? oSocMatch.text  : String(x.IDSOCIEDAD ?? "");
          const sCediTxt     = oCediMatch ? oCediMatch.text : String(x.IDCEDI ?? "");

          return {
            _id: x._id,

            // IDs reales
            IDSOCIEDAD: String(x.IDSOCIEDAD ?? ""),
            IDCEDI:     String(x.IDCEDI ?? ""),
            IDETIQUETA: x.IDETIQUETA,
            IDVALOR:    String(x.IDVALOR ?? ""),
            IDGRUPOET:  String(x.IDGRUPOET ?? ""),
            ID:         String(x.ID ?? ""),

            // ✅ Textos amigables para la tabla
            SOCIEDAD_TXT: sSociedadTxt,
            CEDI_TXT:     sCediTxt,
            ETIQUETA_TXT: sEtiquetaTxt,
            VALOR_TXT:    sValorTxt,

            // Para combos (Grupo ET, etc.)
            text: sEtiquetaTxt,
            key:  x.IDETIQUETA,

            INFOAD: x.INFOAD,
            FECHAREG: x.FECHAREG,
            HORAREG: x.HORAREG,
            USUARIOREG: x.USUARIOREG,
            FECHAULTMOD: x.FECHAULTMOD,
            HORAULTMOD: x.HORAULTMOD,
            USUARIOMOD: x.USUARIOMOD,
            ACTIVO: x.ACTIVO,
            BORRADO: x.BORRADO,

            EstadoTxt: x.ACTIVO ? "Activo" : "Inactivo",
            EstadoUI5: x.ACTIVO ? "Success" : "Error",
            EstadoIcon: x.ACTIVO ? "sap-icon://sys-enter-2" : "sap-icon://status-negative",
            EstadoIconColor: x.ACTIVO ? "Positive" : "Negative",

            RegistroCompleto: `${x.FECHAREG || ''} ${x.HORAREG || ''} (${x.USUARIOREG || 'N/A'})`,
            ModificacionCompleta: x.FECHAULTMOD
              ? `${x.FECHAULTMOD} ${x.HORAULTMOD} (${x.USUARIOMOD || 'N/A'})`
              : 'Sin modificaciones'
          };
        });

        // Guardamos todo tal cual viene del backend pero enriquecido
        this._aAllItems = normalized;
        this._aFilteredItems = [...this._aAllItems];

        // Modelo de la tabla y primera página
        this.getView().setModel(new JSONModel(), "grupos");
        this._updateTablePage();

      } catch (e) {
        MessageToast.show("Error cargando datos: " + e.message);
      } finally {
        oView.setBusy(false);
        this.onSelectionChange(); // deshabilita botones de acción
      }
    },

    onSelectionChange: function () {
      const oTable = this.byId("tblGrupos");
      const aItems = oTable.getSelectedItems();
      const iCount = aItems.length;

      // Para editar solo tiene sentido 1 registro seleccionado
      this.byId("btnEdit").setEnabled(iCount === 1);

      // Para eliminar / activar / desactivar permitimos varios
      const bHasSelection = iCount > 0;

      this.byId("btnDelete").setEnabled(bHasSelection);
      this.byId("btnDeactivate").setEnabled(bHasSelection);
      this.byId("btnActivate").setEnabled(bHasSelection);
    },

    _getSelectedRecords: function () {
      const oTable = this.byId("tblGrupos");
      const aItems = oTable.getSelectedItems() || [];

      return aItems.map(oItem =>
        oItem.getBindingContext("grupos").getObject()
      );
    },

    onRowPress: function (oEvent) {
      const rec = oEvent.getSource().getBindingContext("grupos").getObject();
      // abrir diálogo de edición, etc.
    },

    //función de búsqueda ////////////////////////////////////////////////////////////////////////////////

    // ==== LÓGICA DE FILTRADO Y BÚSQUEDA (quick search) ====
    onSearch1:function (oEvent) {
      var sQuery =
        oEvent.getParameter("newValue") ||
        oEvent.getParameter("query") ||
        (oEvent.getSource && oEvent.getSource().getValue && oEvent.getSource().getValue()) ||
        "";

      this._sSearchQuery = sQuery;   // guardamos el texto
      this._applyTableFilters();     // filtramos en _aAllItems
    },

    // === Helper: obtener el registro seleccionado de la tabla ===
    _getSelectedRecord: function () {
      const oTable = this.byId("tblGrupos");
      const oItem = oTable.getSelectedItem();
      if (!oItem) return null;
      return oItem.getBindingContext("grupos").getObject();
    },

    // === Helper: construir el payload que espera tu API ===
    _buildDeletePayload: function (rec) {
      // El backend (en tu screenshot) espera exactamente estas claves:
      return {
        "IDSOCIEDAD": rec.IDSOCIEDAD,
        "IDCEDI": rec.IDCEDI,
        "IDETIQUETA": rec.IDETIQUETA,
        "IDVALOR": rec.IDVALOR,
        "IDGRUPOET": rec.IDGRUPOET,
        "ID": rec.ID
      };
    },

    _getApiParams: function (sProcessType) { // <-- 1. AÑADIMOS UN PARÁMETRO
      const oSwitchModel = this.getView().getModel("dbServerSwitch");
      const bIsAzure = oSwitchModel.getProperty("/state");

      const sDBServer = bIsAzure ? "Azure" : "Mongodb";
      const sLoggedUser = "FMIRANDAJ"; // Asegúrate que este sea el usuario correcto

      // 2. ¡LA SOLUCIÓN! Usamos la URL completa de Render
      const sBaseUrl = "https://app-restful-sap-cds.onrender.com/api/security/gruposet/crud";

      // 3. Devolvemos la URL completa con todos los parámetros
      return `${sBaseUrl}?ProcessType=${sProcessType}&DBServer=${sDBServer}&LoggedUser=${sLoggedUser}`;
    },

    // === Acción: DESACTIVAR (Delete lógico) ===
    onDeactivePress: async function () {
      const rec = this._getSelectedRecord();
      if (!rec) {
        MessageToast.show("Selecciona un registro primero.");
        return;
      }

      const url = this._getApiParams("DeleteOne");
      const payload = this._buildDeletePayload(rec);

      const doCall = async () => {
        this.getView().setBusy(true);
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error("HTTP " + res.status);

          // Éxito
          MessageToast.show("Registro desactivado correctamente.");
          await this._loadData(); // recarga la tabla
        } catch (e) {
          MessageBox.error("No se pudo desactivar: " + e.message);
          // console.error(e); // si quieres ver detalle en consola
        } finally {
          this.getView().setBusy(false);
        }
      };

      MessageBox.confirm(
        `¿Desactivar el grupo "${rec.IDETIQUETA}" (ID ${rec.ID})?`,
        {
          title: "Confirmar desactivación",
          actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
          onClose: (act) => { if (act === MessageBox.Action.OK) doCall(); }
        }
      );
    },
    //activar con updateOne ///////////

    onActivePress: async function () {
      const rec = this._getSelectedRecord();
      if (!rec) { sap.m.MessageToast.show("Selecciona un registro."); return; }

      const url = this._getApiParams("UpdateOne");

      // Llaves + campos a actualizar
      const payload = {
        ...this._buildDeletePayload(rec),   // IDSOCIEDAD, IDCEDI, IDETIQUETA, IDVALOR, IDGRUPOET, ID
        data: {
          ACTIVO: true,
          BORRADO: false
          // Puedes agregar auditoría si tu backend la usa:
          // FECHAULTMOD: this._todayStr(), HORAULTMOD: this._timeStr(), USUARIOMOD: "FMIRANDAJ"
        }
      };

      this.getView().setBusy(true);
      try {
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error("HTTP " + res.status + (json.messageUSR ? " - " + json.messageUSR : ""));

        sap.m.MessageToast.show("Registro ACTIVADO.");
        await this._loadData();
        this.byId("tblGrupos").removeSelections(true);
        this.onSelectionChange();
      } catch (e) {
        sap.m.MessageBox.error("No se pudo activar: " + e.message);
      } finally {
        this.getView().setBusy(false);
      }
    },

    onRefreshPress() {
      this._loadData();
    },

    // ==== UI LAYOUT ====
    onCollapseExpandPress() {
      const oSideNavigation = this.byId("sideNavigation"),
        bExpanded = oSideNavigation.getExpanded();
      oSideNavigation.setExpanded(!bExpanded);
    },

    onSideNavItemSelect(oEvent) {

      const oItem = oEvent.getParameter("item");
      const sKey = oItem.getKey(); // Es mejor usar la clave (key) que el texto

      if (sKey === "configuracion") {
        this._getConfigDialog().then(oDialog => oDialog.open());
      } else {
        MessageToast.show(`Item selected: ${oItem.getText()}`);
      }
    },

    // ==== ACCIONES (crear/editar) – placeholders ====
    onCreatePress: async function () {
      await this._loadExternalCatalogData(); // <-- cargar catálogos antes
      this.getView().getModel("cascadeModel").getProperty("/sociedades")
      this._getCreateDialog().then((oDialog) => {
        oDialog.open();
      });
    },


    onSaveCreate: async function () {

      const oCreateModel = this.getView().getModel("createModel");
      const oCreate = oCreateModel.getData(); // Datos del formulario

      try {
        const payload = {
          IDSOCIEDAD: oCreate.IDSOCIEDAD,
          IDCEDI: oCreate.IDCEDI,
          IDETIQUETA: oCreate.IDETIQUETA,
          IDVALOR: oCreate.IDVALOR,
          IDGRUPOET: oCreate.IDGRUPOET,
          ID: oCreate.ID,
          INFOAD: oCreate.INFOAD,
          ACTIVO: true,
          BORRADO: false
        };

        const url = this._getApiParams("Create");
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          if (res.status === 409) {
            MessageBox.error("Ya existe un registro con estos datos. No se puede crear un duplicado.");
            return;
          }
          const json = await res.json().catch(() => ({}));
          MessageBox.error(json.error || "No se pudo crear el registro.");
          return;
        }

        MessageToast.show("Grupo creado correctamente.");
        this.getView().getModel("createModel").setData({});
        this._getCreateDialog().then(oDialog => {
          oDialog.close();
        });
        await this._loadData();

      } catch (error) {
        console.error("Error al crear el grupo:", error);
        MessageBox.error("Error inesperado al crear el grupo.");
      }
    },


    // (Esta es la función para el botón "Cancelar" del pop-up)
    onCancelCreate: function () {
      this.getView().getModel("createModel").setData({});

      this._getCreateDialog().then(oDialog => {
        oDialog.close();
      });
    },

    _getCreateDialog: function () {
      if (!this._oCreateDialog) {
        this._oCreateDialog = Fragment.load({
          id: this.getView().getId(),
          name: "com.itt.ztgruposet.frontendztgruposet.view.fragments.CreateDialog",
          controller: this
        }).then(oDialog => {
          this.getView().addDependent(oDialog);
          return oDialog;
        });
      }
      return this._oCreateDialog;
    },

      _loadExternalCatalogData: async function () {

        const oView = this.getView();

        // Modelo donde conectan tus ComboBox del create
        const oCascadeModel = new sap.ui.model.json.JSONModel({
            sociedades: [],
            cedisAll: [],
            etiquetasAll: [],
            valoresAll: []
        });

        oView.setModel(oCascadeModel, "cascadeModel");

        // Detectar servidor seleccionado (Mongo / Azure)
        const oSwitchModel = this.getView().getModel("dbServerSwitch");
        const bIsAzure = oSwitchModel.getProperty("/state");

        const sBaseUrl = "http://localhost:3034/api/cat/crudLabelsValues";
        const sDBServer = bIsAzure ? "CosmosDB" : "MongoDB";
        const sLoggedUser = "MIGUELLOPEZ";

        const url = `${sBaseUrl}?ProcessType=GetAll&LoggedUser=${sLoggedUser}&DBServer=${sDBServer}`;

        try {

            const res = await fetch(url, {
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
                })
            });

            const data = await res.json();
            const registros = data.data?.[0]?.dataRes || [];

            console.warn("Registros recibidos:", registros);

            if (!Array.isArray(registros) || registros.length === 0) {
                console.warn("⚠️ No se encontraron registros en la respuesta");
                return;
            }

            const sociedades = [];
            const cedis = [];
            const etiquetas = [];
            const valores = [];
            console.log("📥 Respuesta del backend de Miguel:", registros);
            registros.forEach((item) => {

                // OBTENER CATALOGO DE SOCIEDADES
                if (item.ETIQUETA === "Sociedades Corporativas" && item.IDETIQUETA === "SOCIEDAD") {
                    item.valores.forEach(v => {
                        sociedades.push({
                            key: v.IDSOCIEDAD,
                            text: v.VALOR
                        });
                    });
                }

                // OBTENER CATALOGO DE CEDIS
                if (item.ETIQUETA === "Centros de Distribución" && item.IDETIQUETA === "CEDI") {
                    item.valores.forEach(v => {
                        cedis.push({
                            key: v.IDCEDI,
                            text: v.VALOR,
                            parentSoc: v.IDSOCIEDAD
                        });
                    });
                }

                // ETIQUETAS
                if (
                    item.IDETIQUETA &&
                    item.IDSOCIEDAD &&
                    item.IDCEDI &&
                    !etiquetas.some(e => e.key === item.IDETIQUETA) &&
                    item.IDETIQUETA !== "SOCIEDAD" &&
                    item.IDETIQUETA !== "CEDI"
                ) {
                    etiquetas.push({
                        key: item.IDETIQUETA,
                        text: item.ETIQUETA,
                        IDETIQUETA: item.IDETIQUETA,
                        IDSOCIEDAD: item.IDSOCIEDAD,
                        IDCEDI: item.IDCEDI,
                        COLECCION: item.COLECCION ?? "",
                        SECCION: item.SECCION ?? "",
                        createdAt: item.createdAt ?? "",
                        updatedAt: item.updatedAt ?? "",
                        _raw: item
                    });
                }

                // VALORES
                if (item.valores && item.valores.length > 0) {
                    item.valores.forEach(v => {
                        if (v.IDETIQUETA !== "CEDI" && v.IDETIQUETA !== "SOCIEDAD") {
                            valores.push({
                                key: v.IDVALOR,
                                text: v.VALOR,
                                IDVALOR: v.IDVALOR,
                                IDSOCIEDAD: v.IDSOCIEDAD,
                                IDCEDI: v.IDCEDI,
                                parentEtiqueta: item.IDETIQUETA
                            });
                        }
                    });
                }
            });

            console.log("Sociedades:", sociedades);
            console.log("Cedis:", cedis);
            console.log("Etiquetas:", etiquetas);
            console.log("Valores:", valores);

            // Guardar datos en el modelo
            oCascadeModel.setProperty("/sociedades", sociedades);
            oCascadeModel.setProperty("/cedisAll", cedis);
            oCascadeModel.setProperty("/etiquetasAll", etiquetas);
            oCascadeModel.setProperty("/valoresAll", valores);

        } catch (err) {
            console.error("❌ Error al cargar catálogos:", err);

            oCascadeModel.setProperty("/sociedades", []);
            oCascadeModel.setProperty("/cedisAll", []);
            oCascadeModel.setProperty("/etiquetasAll", []);
            oCascadeModel.setProperty("/valoresAll", []);
        }
    },

    // --- PASO 1: Poblar Sociedades ---
    _populateSociedades: function () {
      const oCascadeModel = this.getView().getModel("cascadeModel");
      // Usamos '...new Set' para obtener valores únicos de la lista maestra
      const aNombresSoc = [...new Set(this._aCatalogData.map(item => item.IDSOCIEDAD))];
      // Filtramos 'undefined' por si algún registro no tiene sociedad
      const aSociedades = aNombresSoc.filter(id => id !== undefined).map(id => ({ key: id, text: id }));
      oCascadeModel.setProperty("/sociedades", aSociedades);
    },

    // --- PASO 2: Evento al cambiar Sociedad ---
    onSociedadChange: function (oEvent) {
      const selectedSoc = oEvent.getSource().getSelectedKey();
      const oCreateModel = this.getView().getModel("createModel");
      const oModel = this.getView().getModel("cascadeModel");

      console.log("✅ Sociedad seleccionada:", selectedSoc);

      // Limpiar combos dependientes
      oCreateModel.setProperty("/IDCEDI", null);
      oCreateModel.setProperty("/IDETIQUETA", null);
      oCreateModel.setProperty("/IDVALOR", null);

      oModel.setProperty("/cedis", []);
      oModel.setProperty("/etiquetas", []);
      oModel.setProperty("/valores", []);

      if (!selectedSoc) return;

      const allCedis = oModel.getProperty("/cedisAll") || [];
      const filteredCedis = allCedis.filter((c) => c.parentSoc == selectedSoc);

      console.log("🟩 CEDIS filtrados:", filteredCedis);
      oModel.setProperty("/cedis", filteredCedis);
    },


    onCediChange: function (oEvent) {
      const selectedCedi = oEvent.getSource().getSelectedKey();
      const oCreateModel = this.getView().getModel("createModel");
      const selectedSoc = oCreateModel.getProperty("/IDSOCIEDAD");
      const oModel = this.getView().getModel("cascadeModel");

      console.log("✅ CEDI seleccionado:", selectedCedi, "Sociedad:", selectedSoc);

      // Limpiar combos dependientes
      oCreateModel.setProperty("/IDETIQUETA", null);
      oCreateModel.setProperty("/IDVALOR", null);

      oModel.setProperty("/etiquetas", []);
      oModel.setProperty("/valores", []);

      if (!selectedCedi || !selectedSoc) return;

      const allEtiquetas = oModel.getProperty("/etiquetasAll") || [];
      const filteredEtiquetas = allEtiquetas.filter(
        (e) => e.IDSOCIEDAD == selectedSoc && e.IDCEDI == selectedCedi
      );

      console.log("🟩 Etiquetas filtradas:", filteredEtiquetas);
      oModel.setProperty("/etiquetas", filteredEtiquetas);
      console.log(">>> etiquetasAll:", oModel.getProperty("/etiquetasAll"));
      console.log(">>> etiquetas filtradas:", oModel.getProperty("/etiquetas"));
      console.log(">>> createModel:", this.getView().getModel("createModel").getData());

    },

    onEtiquetaChange: function (oEvent) {
      const selectedEtiqueta = oEvent.getSource().getSelectedKey();
      const oCreateModel = this.getView().getModel("createModel");
      const selectedSoc = oCreateModel.getProperty("/IDSOCIEDAD");
      const selectedCedi = oCreateModel.getProperty("/IDCEDI");
      const oModel = this.getView().getModel("cascadeModel");

      console.log("✅ Etiqueta seleccionada:", selectedEtiqueta, "Soc:", selectedSoc, "Cedi:", selectedCedi);

      // Limpiar combo dependiente
      oCreateModel.setProperty("/IDVALOR", null);
      oModel.setProperty("/valores", []);

      if (!selectedEtiqueta || !selectedSoc || !selectedCedi) return;

      const allValores = oModel.getProperty("/valoresAll") || [];
      const filteredValores = allValores.filter(
        (v) =>
          v.IDSOCIEDAD == selectedSoc &&
          v.IDCEDI == selectedCedi &&
          v.parentEtiqueta == selectedEtiqueta
      );

      console.log("🟦 Valores filtrados:", filteredValores);
      oModel.setProperty("/valores", filteredValores);
    },


    onEditPress: async function () {
      const oRec = this._getSelectedRecord();
      if (!oRec) {
        MessageToast.show("Selecciona un registro para editar.");
        return;
      }

      // 🟢 GUARDAR COPIA DEL REGISTRO ORIGINAL (para enviar llaves originales al backend)
      this._originalRecord = Object.assign({}, oRec);

      // 1. Cargar catálogos externos
      await this._loadExternalCatalogData();

      // 2. Copiar datos al updateModel
      const oUpdateModel = this.getView().getModel("updateModel");
      oUpdateModel.setData(Object.assign({}, oRec));

      // 3. Pre-cargar cascadas
      await this._preloadUpdateCascades(oRec);

      console.log("📝 Registro original guardado:", this._originalRecord);

      // 4. Abrir diálogo
      this._getUpdateDialog().then(oDialog => {
        oDialog.open();
      });
    },

    _preloadUpdateCascades: async function (oRec) {
      const oCascadeModel = this.getView().getModel("cascadeModel");

      // Cargar CEDIS para la Sociedad seleccionada
      if (oRec.IDSOCIEDAD) {
        const allCedis = oCascadeModel.getProperty("/cedisAll") || [];
        const filteredCedis = allCedis.filter(c => c.parentSoc == oRec.IDSOCIEDAD);
        oCascadeModel.setProperty("/cedis", filteredCedis);
      }

      // Cargar ETIQUETAS para Sociedad + CEDI
      if (oRec.IDSOCIEDAD && oRec.IDCEDI) {
        const allEtiquetas = oCascadeModel.getProperty("/etiquetasAll") || [];
        const filteredEtiquetas = allEtiquetas.filter(
          e => e.IDSOCIEDAD == oRec.IDSOCIEDAD && e.IDCEDI == oRec.IDCEDI
        );
        oCascadeModel.setProperty("/etiquetas", filteredEtiquetas);
      }

      // Cargar VALORES para Sociedad + CEDI + Etiqueta
      if (oRec.IDSOCIEDAD && oRec.IDCEDI && oRec.IDETIQUETA) {
        const allValores = oCascadeModel.getProperty("/valoresAll") || [];
        const filteredValores = allValores.filter(
          v => v.IDSOCIEDAD == oRec.IDSOCIEDAD &&
            v.IDCEDI == oRec.IDCEDI &&
            v.parentEtiqueta == oRec.IDETIQUETA
        );
        oCascadeModel.setProperty("/valores", filteredValores);
      }
    },

      _preloadInlineCascades: function (oRec) {
        const oCascade = this.getView().getModel("cascadeModel");

        const aCedisAll     = oCascade.getProperty("/cedisAll")     || [];
        const aEtiquetasAll = oCascade.getProperty("/etiquetasAll") || [];
        const aValoresAll   = oCascade.getProperty("/valoresAll")   || [];

        let aCedis     = [];
        let aEtiquetas = [];
        let aValores   = [];

        // CEDIS
        if (oRec.IDSOCIEDAD) {
            aCedis = aCedisAll.filter(c =>
                String(c.parentSoc) === String(oRec.IDSOCIEDAD)
            );
        }

        // ETIQUETAS
        if (oRec.IDSOCIEDAD && oRec.IDCEDI) {
            const aEtiquetasFiltradas = aEtiquetasAll.filter(e =>
                String(e.IDSOCIEDAD) === String(oRec.IDSOCIEDAD) &&
                String(e.IDCEDI)     === String(oRec.IDCEDI)
            );

            // 🔑👀 AQUÍ armamos SIEMPRE key + text
            aEtiquetas = aEtiquetasFiltradas.map(e => ({
                // conservas todo lo original
                ...e,
                // key que usará el ComboBox (por si lo necesitas)
                key: e.IDETIQUETA,
                // texto visible
                text:
                    (e.text      && String(e.text).trim())      ||
                    (e.ALIAS     && String(e.ALIAS).trim())     ||
                    (e.ETIQUETA  && String(e.ETIQUETA).trim())  ||
                    e.IDETIQUETA
            }));
        }

        // VALORES
        if (oRec.IDSOCIEDAD && oRec.IDCEDI && oRec.IDETIQUETA) {
            aValores = aValoresAll.filter(v =>
                String(v.IDSOCIEDAD)     === String(oRec.IDSOCIEDAD) &&
                String(v.IDCEDI)         === String(oRec.IDCEDI) &&
                String(v.parentEtiqueta) === String(oRec.IDETIQUETA)
            );
        }

        oCascade.setProperty("/cedis",     aCedis);
        oCascade.setProperty("/etiquetas", aEtiquetas);  // 👉 ahora traen text
        oCascade.setProperty("/valores",   aValores);
    },
    // ========== CASCADAS PARA UPDATE DIALOG ==========

    onUpdateSociedadChange: function (oEvent) {
      const selectedSoc = oEvent.getSource().getSelectedKey();
      const oUpdateModel = this.getView().getModel("updateModel");
      const oModel = this.getView().getModel("cascadeModel");

      // Limpiar campos dependientes
      oUpdateModel.setProperty("/IDCEDI", null);
      oUpdateModel.setProperty("/IDETIQUETA", null);
      oUpdateModel.setProperty("/IDVALOR", null);
      oUpdateModel.setProperty("/IDGRUPOET", null);

      oModel.setProperty("/cedis", []);
      oModel.setProperty("/etiquetas", []);
      oModel.setProperty("/valores", []);

      if (!selectedSoc) return;

      const allCedis = oModel.getProperty("/cedisAll") || [];
      const filteredCedis = allCedis.filter(c => c.parentSoc == selectedSoc);
      oModel.setProperty("/cedis", filteredCedis);
    },

    onUpdateCediChange: function (oEvent) {
      const selectedCedi = oEvent.getSource().getSelectedKey();
      const oUpdateModel = this.getView().getModel("updateModel");
      const selectedSoc = oUpdateModel.getProperty("/IDSOCIEDAD");
      const oModel = this.getView().getModel("cascadeModel");

      // Limpiar campos dependientes
      oUpdateModel.setProperty("/IDETIQUETA", null);
      oUpdateModel.setProperty("/IDVALOR", null);
      oUpdateModel.setProperty("/IDGRUPOET", null);

      oModel.setProperty("/etiquetas", []);
      oModel.setProperty("/valores", []);

      if (!selectedCedi || !selectedSoc) return;

      const allEtiquetas = oModel.getProperty("/etiquetasAll") || [];
      const filteredEtiquetas = allEtiquetas.filter(
        e => e.IDSOCIEDAD == selectedSoc && e.IDCEDI == selectedCedi
      );
      oModel.setProperty("/etiquetas", filteredEtiquetas);
    },

    onUpdateEtiquetaChange: function (oEvent) {
      const selectedEtiqueta = oEvent.getSource().getSelectedKey();
      const oUpdateModel = this.getView().getModel("updateModel");
      const selectedSoc = oUpdateModel.getProperty("/IDSOCIEDAD");
      const selectedCedi = oUpdateModel.getProperty("/IDCEDI");
      const oModel = this.getView().getModel("cascadeModel");

      // Limpiar valor dependiente
      oUpdateModel.setProperty("/IDVALOR", null);
      oUpdateModel.setProperty("/IDGRUPOET", null);

      oModel.setProperty("/valores", []);

      if (!selectedEtiqueta || !selectedSoc || !selectedCedi) return;

      const allValores = oModel.getProperty("/valoresAll") || [];
      const filteredValores = allValores.filter(
        v => v.IDSOCIEDAD == selectedSoc &&
          v.IDCEDI == selectedCedi &&
          v.parentEtiqueta == selectedEtiqueta
      );
      oModel.setProperty("/valores", filteredValores);
    },

    onUpdateEtiquetaFilterPress: function () {
      const oUpdateModel = this.getView().getModel("updateModel");
      const selectedSoc = oUpdateModel.getProperty("/IDSOCIEDAD");
      const selectedCedi = oUpdateModel.getProperty("/IDCEDI");

      if (!selectedSoc || !selectedCedi) {
        MessageToast.show("Selecciona Sociedad y CEDI antes de aplicar filtros.");
        return;
      }

      // Reutilizar la misma lógica de filtros que en Create
      // Solo cambiamos el contexto para que lea de updateModel
      this._currentEditContext = "update"; // flag para saber qué modelo usar
      this.onEtiquetaFilterPress();
    },
    
    onInlineEtiquetaFilterPress: function () {
      const oInline = this.getView().getModel("inlineEdit");
      const sSoc  = oInline.getProperty("/current/IDSOCIEDAD");
      const sCedi = oInline.getProperty("/current/IDCEDI");

      if (!sSoc || !sCedi) {
        MessageToast.show("Selecciona Sociedad y CEDI antes de filtrar etiquetas.");
        return;
      }

      // 🔹 contexto de trabajo: inline
      this._currentEditContext = "inline";

      // reutilizamos el mismo diálogo de filtros
      this.onEtiquetaFilterPress();
    },

   // Abre el diálogo de Grupo ET desde el modal de UPDATE
    onUpdateOpenGrupoEt: async function () {
        const oUpdateModel = this.getView().getModel("updateModel");

        // 👇 Tomamos el objeto actual (soporta /current o raíz)
        const oUpdateData  = oUpdateModel.getProperty("/current") || oUpdateModel.getData() || {};

        const sSoc  = oUpdateData.IDSOCIEDAD;
        const sCedi = oUpdateData.IDCEDI;

        if (!sSoc || !sCedi) {
            MessageToast.show("Selecciona primero Sociedad y CEDI.");
            return;
        }

        // 🔴 Indicamos que el diálogo está en modo "update"
        this._grupoEtEditMode = "update";

        // 👇 Aseguramos que los catálogos estén cargados
        if (!this._bCatalogLoaded) {
            await this._loadExternalCatalogData();
            this._bCatalogLoaded = true;
        }

        const oCascade = this.getView().getModel("cascadeModel");
        const oGM      = this.getView().getModel("grupoEtModel");

        // 1) Tomamos todas las etiquetas (All o la lista normal)
        const aAllEtiquetas =
            oCascade.getProperty("/etiquetasAll") ||
            oCascade.getProperty("/etiquetas")   ||
            [];

          console.log("Sociedad UPDATE:", sSoc, "CEDI UPDATE:", sCedi);
          console.log("EtiquetasAll:", aAllEtiquetas);

        // 2) Filtramos por Sociedad / CEDI
        const aFiltradas = aAllEtiquetas.filter(e =>
            String(e.IDSOCIEDAD) === String(sSoc) &&
            String(e.IDCEDI)     === String(sCedi)
        );

        // 3) Mapeamos al formato que usa el diálogo
        const aComboItems = aFiltradas.map(e => ({
            key: e.IDETIQUETA,
            text: 
                (e.text && String(e.text).trim()) ||
                (e.ALIAS && String(e.ALIAS).trim()) ||
                (e.ETIQUETA && String(e.ETIQUETA).trim()) ||
                e.IDETIQUETA,
            IDETIQUETA: e.IDETIQUETA,
            RAW_TEXT: e.text || e.ETIQUETA
        }));

        // 4) Guardamos en grupoEtModel para que el ComboBox lo muestre
        oGM.setProperty("/etiquetas", aComboItems);

        // 5) Precargamos selección del registro (si ya tenía grupo ET)
        oGM.setProperty("/selectedEtiqueta", oUpdateData.IDETIQUETA || null);
        oGM.setProperty("/selectedValor",   oUpdateData.IDVALOR    || null);
        oGM.setProperty("/valoresList",     []);
        oGM.setProperty("/displayName",     oUpdateData.IDGRUPOET  || "");

        // Si ya tienes lógica extra para precargar valores, la llamas aquí
        this._preloadGrupoEtForUpdate && this._preloadGrupoEtForUpdate();

        // 6) Abrimos (o creamos) el fragmento del diálogo
        if (!this._oGrupoEtDialog) {
            sap.ui.core.Fragment.load({
                id: this.getView().getId() + "--grupoEtDialog",
                name: "com.itt.ztgruposet.frontendztgruposet.view.fragments.GrupoEtDialog",
                controller: this
            }).then(oDialog => {
                this._oGrupoEtDialog = oDialog;
                this.getView().addDependent(oDialog);
                oDialog.open();
            });
        } else {
            this._oGrupoEtDialog.open();
        }
    },

    _preloadGrupoEtForUpdate: function () {
      const oUpdate  = this.getView().getModel("updateModel");
      const oGM      = this.getView().getModel("grupoEtModel");
      const oCascade = this.getView().getModel("cascadeModel");

      const sGrupoEt = oUpdate.getProperty("/IDGRUPOET"); // p.ej. "TURNO_OPERATIVO-TURNO_MATUTINO"

      if (!sGrupoEt || !sGrupoEt.includes("-")) {
        oGM.setProperty("/selectedEtiqueta", null);
        oGM.setProperty("/selectedValor", null);
        oGM.setProperty("/valoresList", []);
        oGM.setProperty("/displayName", "");
        return;
      }

      const [sEtiId, sValId] = sGrupoEt.split("-");

      const selectedSoc  = oUpdate.getProperty("/IDSOCIEDAD");
      const selectedCedi = oUpdate.getProperty("/IDCEDI");
      const valoresAll   = oCascade.getProperty("/valoresAll") || [];

      const aFiltered = valoresAll.filter(v =>
        String(v.IDSOCIEDAD)     === String(selectedSoc) &&
        String(v.IDCEDI)         === String(selectedCedi) &&
        String(v.parentEtiqueta) === String(sEtiId)
      );

      // 🔁 Mismo mapeo que en onGrupoEtiquetaChange
      const aMappedVals = aFiltered.map(v => {
        const sTxt =
          (v.text && String(v.text).trim()) ||
          (v.ALIAS && v.ALIAS.trim()) ||
          (v.VALOR && v.VALOR.trim()) ||
          v.IDVALOR;

        return {
          IDVALOR:        v.IDVALOR,
          VALOR:          sTxt,
          ALIAS:          v.ALIAS || "",
          RAW_VALOR:      v.text || v.VALOR,
          IDSOCIEDAD:     v.IDSOCIEDAD,
          IDCEDI:         v.IDCEDI,
          parentEtiqueta: v.parentEtiqueta
        };
      });

      oGM.setProperty("/selectedEtiqueta", sEtiId);
      oGM.setProperty("/valoresList", aMappedVals);
      oGM.setProperty("/selectedValor", sValId);
      oGM.setProperty("/displayName", sGrupoEt);
    },

    onSaveUpdate: async function () {
      const oView = this.getView();
      const oUpdateModel = oView.getModel("updateModel");
      const oRecActualizado = oUpdateModel.getData();
      const oRecOriginal = this._originalRecord; // 🟢 Guardamos el registro original

      // Validar campos requeridos
      if (!oRecActualizado.IDSOCIEDAD || !oRecActualizado.IDCEDI ||
        !oRecActualizado.IDETIQUETA || !oRecActualizado.IDVALOR ||
        !oRecActualizado.INFOAD) {
        MessageBox.error("Por favor completa todos los campos requeridos.");
        return;
      }

      const url = this._getApiParams("UpdateOne");

      // 🟢 Estructura: Llaves ORIGINALES + data con CAMBIOS
      const payload = {
        // Llaves ORIGINALES (para identificar el registro)
        IDSOCIEDAD: oRecOriginal.IDSOCIEDAD,
        IDCEDI: oRecOriginal.IDCEDI,
        IDETIQUETA: oRecOriginal.IDETIQUETA,
        IDVALOR: oRecOriginal.IDVALOR,
        IDGRUPOET: oRecOriginal.IDGRUPOET,
        ID: oRecOriginal.ID,

        // Datos NUEVOS (pueden incluir cambios en las llaves)
        data: {
          IDSOCIEDAD: oRecActualizado.IDSOCIEDAD,
          IDCEDI: oRecActualizado.IDCEDI,
          IDETIQUETA: oRecActualizado.IDETIQUETA,
          IDVALOR: oRecActualizado.IDVALOR,
          IDGRUPOET: oRecActualizado.IDGRUPOET,
          ID: oRecActualizado.ID,
          INFOAD: oRecActualizado.INFOAD,
          ACTIVO: oRecActualizado.ACTIVO !== false,
          BORRADO: oRecActualizado.BORRADO || false
        }
      };

      console.log("📤 URL:", url);
      console.log("📦 Payload:", JSON.stringify(payload, null, 2));

      oView.setBusy(true);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          // 🟢 Manejo especial para duplicados
          if (res.status === 409) {
            MessageBox.error("Ya existe un registro con esos datos. No se puede actualizar.");
            return;
          }
          throw new Error("HTTP " + res.status + (json.messageUSR ? " - " + json.messageUSR : ""));
        }

        MessageToast.show("Registro actualizado correctamente.");
        this._getUpdateDialog().then(oDialog => oDialog.close());
        await this._loadData();
        this.byId("tblGrupos").removeSelections(true);

      } catch (e) {
        console.error("💥 Error:", e);
        MessageBox.error("No se pudo actualizar: " + e.message);
      } finally {
        oView.setBusy(false);
      }
    },

    // (Esta es la función para el botón "Cancelar" del pop-up)
    onCancelUpdate: function () {
      this.getView().getModel("updateModel").setData({});

      this._getUpdateDialog().then(oDialog => {
        oDialog.close();
      });
    },

    // (Esta es una función "Helper" que carga el Fragmento XML)
    _getUpdateDialog: function () {
      if (!this._oUpdateDialog) {
        this._oUpdateDialog = Fragment.load({
          id: this.getView().getId(),
          name: "com.itt.ztgruposet.frontendztgruposet.view.fragments.UpdateDialog",
          controller: this
        }).then(oDialog => {
          this.getView().addDependent(oDialog);
          return oDialog;
        });
      }
      return this._oUpdateDialog;
    },

    //======= Filtros para el campo de etiquetas =======

    _getEtiquetaFilterDialog: function () {
      if (!this._oEtiquetaFilterDialog) {
        this._oEtiquetaFilterDialog = Fragment.load({
          id: this.getView().getId(),   // prefija con el ID del view
          name: "webapp.view.fragments.EtiquetaFilterDialog",
          controller: this
        })
          .then(oDialog => {
            this.getView().addDependent(oDialog);
            return oDialog;
          });
      }
      return this._oEtiquetaFilterDialog;
    },

    // ¡ESTA ES LA FUNCIÓN QUE LLAMA TU BOTÓN!
    onOpenEtiquetaFilter: function () {
      const oCascadeModel = this.getView().getModel("cascadeModel");
      const oFilterModel = this.getView().getModel("etiquetaFilterModel");

      // 1. Obtener la lista de etiquetas YA FILTRADAS (por Sociedad y CEDI)
      // Esta es la lista que actualmente está en el ComboBox de Etiquetas
      const aEtiquetasActuales = oCascadeModel.getProperty("/etiquetas");

      if (!aEtiquetasActuales || aEtiquetasActuales.length === 0) {
        MessageToast.show("No hay etiquetas para filtrar.");
        return;
      }

      // 2. Necesitamos encontrar los datos completos de estas etiquetas
      //    (para obtener sus 'COLECCION' y 'SECCION' de la lista maestra)
      const aEtiquetasCompletas = aEtiquetasActuales.map(etiqueta => {
        // Buscamos en la lista maestra que cargamos al inicio
        return this._aCatalogData.find(item => item.IDETIQUETA === etiqueta.key);
      }).filter(item => !!item); // Filtra los 'undefined' (si no se encuentra)

      // 3. Extraer listas únicas de Colección y Sección
      const aColeccionesUnicas = [...new Set(aEtiquetasCompletas.map(item => item.COLECCION).filter(c => !!c))];
      const aSeccionesUnicas = [...new Set(aEtiquetasCompletas.map(item => item.SECCION).filter(s => !!s))];

      // 4. Formatear para las listas (y preservar selecciones previas)
      // Obtenemos las selecciones anteriores del modelo
      const aOldSeleccion = oFilterModel.getData();
      const aOldColecciones = aOldSeleccion.colecciones.filter(c => c.selected).map(c => c.text);
      const aOldSecciones = aOldSeleccion.secciones.filter(s => s.selected).map(s => s.text);

      oFilterModel.setProperty("/colecciones", aColeccionesUnicas.map(c => {
        return { text: c, selected: aOldColecciones.includes(c) };
      }));
      oFilterModel.setProperty("/secciones", aSeccionesUnicas.map(s => {
        return { text: s, selected: aOldSecciones.includes(s) };
      }));

      // 5. Abrir el diálogo
      this._getEtiquetaFilterDialog().then(oDialog => {
        oDialog.open();
      });
    },

    // Se llama al presionar "Cancelar" en el pop-up de filtros
    onCancelEtiquetaFilters: function () {
      this._getEtiquetaFilterDialog().then(oDialog => {
        oDialog.close();
      });
    },

    // Se llama al presionar "Aplicar Filtros" en el pop-up de filtros
    onApplyEtiquetaFilters: function () {

      const coleccionList = this.byId("etiquetaFilter--coleccionFilterList");
      const seccionList = this.byId("etiquetaFilter--seccionFilterList");

      const coleccionItems = coleccionList ? coleccionList.getSelectedItems() : [];
      const seccionItems = seccionList ? seccionList.getSelectedItems() : [];

      const coleccionesSel = coleccionItems.map(i => i.getTitle());
      const seccionesSel = seccionItems.map(i => i.getTitle());

      console.log("Colecciones seleccionadas:", coleccionesSel);
      console.log("Secciones seleccionadas:", seccionesSel);

      this._applyEtiquetaFilters();
      this._oEtiquetaFilterDialog.close();
    },

    // ==== DIÁLOGO DE CONFIGURACIÓN ====
    _getConfigDialog: function () {
      if (!this._oConfigDialog) {
        this._oConfigDialog = Fragment.load({
          id: this.getView().getId(),
          name: "com.itt.ztgruposet.frontendztgruposet.view.fragments.ConfigDialog",
          controller: this
        }).then(oDialog => {
          this.getView().addDependent(oDialog);
          return oDialog;
        }).catch(oError => {
          console.error("Error en Fragment.load:", oError);
        });
      }
      return this._oConfigDialog;
    },

    onCancelConfig: function () {
      this._getConfigDialog().then(oDialog => oDialog.close());
    },

    // Cuando cambio el switch de MongoDB <-> Azure
    onDbServerChange: async function (oEvent) {
      const bState = oEvent.getParameter("state");

      // 1) Guardar el estado en el modelo que ya usas para DBServer
      this.getView().getModel("dbServerSwitch").setProperty("/state", bState);

      // 2) (Opcional, si estás usando el modelo "config" para el texto del diálogo)
      //    Esto hace que se pueda usar config>/dbServer en el label del fragmento.
      const sDb = bState ? "azure" : "mongo";
      const oConfigModel = this.getView().getModel("config");
      if (oConfigModel) {
        oConfigModel.setProperty("/dbServer", sDb);
      }

      // 3) Volver a cargar CATÁLOGOS desde la nueva BD (Mongo o Azure)
      await this._loadExternalCatalogData();
      this._bCatalogLoaded = true;

      // 4) Volver a cargar los datos de la tabla desde esa misma BD
      await this._loadData();
    },

    onDeletePress: function () {
      const aRecs = this._getSelectedRecords();
      if (!aRecs || aRecs.length === 0) {
        sap.m.MessageToast.show("Selecciona al menos un registro.");
        return;
      }

      const url = this._getApiParams("DeleteHard");

      // Construimos un texto de confirmación más claro
      const sMsg =
        aRecs.length === 1
          ? `Vas a ELIMINAR físicamente el grupo "${aRecs[0].IDETIQUETA}" (ID ${aRecs[0].ID}).\nEsta acción no se puede deshacer.\n\n¿Continuar?`
          : `Vas a ELIMINAR físicamente ${aRecs.length} registros.\nEsta acción no se puede deshacer.\n\n¿Continuar?`;

      const doDeleteAll = async () => {
        this.getView().setBusy(true);

        try {
          // Ejecutamos los deletes en serie o en paralelo
          for (const rec of aRecs) {
            const payload = this._buildDeletePayload(rec);

            const res = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });

            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
              throw new Error(
                "HTTP " + res.status + (json.messageUSR ? " - " + json.messageUSR : "")
              );
            }
          }

          sap.m.MessageToast.show("Registros eliminados correctamente.");
          await this._loadData();
          this.byId("tblGrupos").removeSelections(true);
          this.onSelectionChange(); // actualiza botones

        } catch (e) {
          console.error(e);
          sap.m.MessageBox.error("No se pudo eliminar: " + e.message);
        } finally {
          this.getView().setBusy(false);
        }
      };

      sap.m.MessageBox.warning(sMsg, {
        title: "Confirmar eliminación definitiva",
        actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
        emphasizedAction: sap.m.MessageBox.Action.OK,
        onClose: function (act) {
          if (act === sap.m.MessageBox.Action.OK) {
            doDeleteAll();
          }
        }
      });
    },
    //filtro rapido ////////////////////////////////////////////////////////////////////////////////
      onQuickFilter: function (oEvent) {
      this._sQuickFilterKey = oEvent.getParameter("key") || "ALL";
      this._applyTableFilters();
    },

      // === FILTRAR TODO EN CLIENTE (search + quick + avanzado) ===
    _applyTableFilters: function () {
      var sQueryRaw = this._sSearchQuery || "";
      var sQuery    = sQueryRaw.toLowerCase().trim();
      var sQuickKey = this._sQuickFilterKey || "ALL";
      var oAF       = this._oAdvancedFilter || {};

      var bIsNumeric = sQueryRaw !== "" && !isNaN(sQueryRaw);
      var iNum       = bIsNumeric ? parseInt(sQueryRaw, 10) : null;

      function containsCI(val, needle) {
        if (!needle) return true;              // sin filtro → no restringe
        var s = (val == null ? "" : String(val)).toLowerCase();
        return s.indexOf(needle.toLowerCase()) !== -1;
      }

      this._aFilteredItems = this._aAllItems.filter(function (oItem) {

        // 1) Filtro rápido por estado (chips)
        if (sQuickKey === "ACT" && oItem.EstadoTxt !== "Activo")   return false;
        if (sQuickKey === "INA" && oItem.EstadoTxt !== "Inactivo") return false;

        // 2) Filtro avanzado (Sociedad, CEDI, Etiqueta, Valor, Estado, Fechas)
        if (oAF) {
          // Sociedad: por texto ó por ID
          if (oAF.Sociedad &&
            !containsCI(oItem.SOCIEDAD_TXT, oAF.Sociedad) &&
            String(oItem.IDSOCIEDAD) !== String(oAF.Sociedad)) {
            return false;
          }

          // CEDI
          if (oAF.Cedi &&
            !containsCI(oItem.CEDI_TXT, oAF.Cedi) &&
            String(oItem.IDCEDI) !== String(oAF.Cedi)) {
            return false;
          }

          // Etiqueta
          if (oAF.Etiqueta &&
            !containsCI(oItem.ETIQUETA_TXT, oAF.Etiqueta) &&
            String(oItem.IDETIQUETA) !== String(oAF.Etiqueta)) {
            return false;
          }

          // Valor
          if (oAF.Valor &&
            !containsCI(oItem.VALOR_TXT, oAF.Valor) &&
            String(oItem.IDVALOR) !== String(oAF.Valor)) {
            return false;
          }

          // Estado del combo del diálogo
          if (oAF.Estado === "ACT" && oItem.EstadoTxt !== "Activo")   return false;
          if (oAF.Estado === "INA" && oItem.EstadoTxt !== "Inactivo") return false;

          // Rango de fechas usando FECHAREG (si quieres):
          if (oAF.From && oAF.To && oItem.FECHAREG) {
            var dItem = new Date(oItem.FECHAREG + "T00:00:00");
            if (!(dItem >= oAF.From && dItem <= oAF.To)) {
              return false;
            }
          }
        }

        // 3) Si no hay texto de búsqueda global → ya pasó filtros
        if (!sQuery) {
          return true;
        }

        // 4) Búsqueda global: de Sociedad hasta ID (textos + IDGRUPOET + INFOAD)
        var aCampos = [
          oItem.SOCIEDAD_TXT,
          oItem.CEDI_TXT,
          oItem.ETIQUETA_TXT,
          oItem.VALOR_TXT,
          oItem.IDGRUPOET,
          oItem.ID,
          oItem.INFOAD,
          oItem.EstadoTxt
        ];

        var sHaystack = aCampos
          .map(function (v) { return (v == null ? "" : String(v)).toLowerCase(); })
          .join(" | ");

        if (sHaystack.indexOf(sQuery) !== -1) {
          return true;
        }

        // 5) Coincidencia numérica exacta en IDs
        if (bIsNumeric) {
          if (Number(oItem.IDSOCIEDAD) === iNum) return true;
          if (Number(oItem.IDCEDI)     === iNum) return true;
          if (Number(oItem.ID)         === iNum) return true;
        }

        return false;
      }.bind(this));

      // Siempre reiniciar a la primera página al cambiar filtros
      this._iCurrentPage = 1;
      this._updateTablePage();
    },

    onFilterApply: function () {
      // ... sacas los valores del diálogo  ...

      var aFilters = [];

      // agregas IDSOCIEDAD, IDCEDI, IDETIQUETA, IDVALOR, fechas, estado, etc.
      // y al final:

      this._aDialogFilters = aFilters;
      this._applyAllFilters();
      this._oFilterDialog.close();
    },

    //aplicion de todos los filtros de busqueda ///////////////////////////////////////////////////////
    _aSearchFilters: [],
    _aDialogFilters: [],
    _aQuickFilters: [],

    
    

    _oFilterDialog: null,

    onFilterPress2: function () {
      var oView = this.getView();

      if (!this._oFilterDialog) {
        this._oFilterDialog = sap.ui.xmlfragment(
          oView.getId(),
          "com.itt.ztgruposet.frontendztgruposet.view.fragments.FilterDialog2",
          this
        );
        oView.addDependent(this._oFilterDialog);
      }

      this._oFilterDialog.open();
    },

    onFilterApply2: function () {
      var oCore = sap.ui.getCore();
      var oView = this.getView();

      var sSoc   = oCore.byId(oView.createId("fSociedad")).getValue().trim();
      var sCedi  = oCore.byId(oView.createId("fCedi")).getValue().trim();
      var sEti   = oCore.byId(oView.createId("fEtiqueta")).getValue().trim();
      var sVal   = oCore.byId(oView.createId("fValor")).getValue().trim();
      var oDRS   = oCore.byId(oView.createId("fRegDate"));
      var oEstadoSB = oCore.byId(oView.createId("fEstado"));

      this._oAdvancedFilter = {
        Sociedad: sSoc || "",
        Cedi:     sCedi || "",
        Etiqueta: sEti || "",
        Valor:    sVal || "",
        Estado:   oEstadoSB.getSelectedKey() || "ALL",
        From:     oDRS.getDateValue() || null,
        To:       oDRS.getSecondDateValue() || null
      };

      this._applyTableFilters();
      this._oFilterDialog.close();
    },

    //limpiar filtros de dialogo ///////////////////////////////////////////////////////
    onFilterClear: function () {
      var oCore = sap.ui.getCore();
      var oView = this.getView();

      oCore.byId(oView.createId("fSociedad")).setValue("");
      oCore.byId(oView.createId("fCedi")).setValue("");
      oCore.byId(oView.createId("fEtiqueta")).setValue("");
      oCore.byId(oView.createId("fValor")).setValue("");
      oCore.byId(oView.createId("fRegDate")).setDateValue(null);
      oCore.byId(oView.createId("fRegDate")).setSecondDateValue(null);
      oCore.byId(oView.createId("fEstado")).setSelectedKey("ALL");

      // 🔄 limpiar filtro avanzado
      this._oAdvancedFilter = null;

      this._applyTableFilters();
    },

    onFilterCancel: function () {
      if (this._oFilterDialog) {
        this._oFilterDialog.close();
      }
    },

    onFilterApply: function () {
      this._applyFiltersAndSort();
      this._getFilterDialog().then(oDialog => oDialog.close());
    },



    onResetFilters: function () {
      this._initFilterModel(); // Restaura el modelo a su estado inicial
      this.byId("searchField").setValue(""); // Limpia el campo de búsqueda visualmente
      this._applyFiltersAndSort();
      this._getFilterDialog().then(oDialog => oDialog.close());
    },

    onFilterFieldSelect: function (oEvent) {
      const iSelectedIndex = oEvent.getParameter("selectedIndex");
      const oFilterModel = this.getView().getModel("filter");
      const sSelectedKey = oFilterModel.getProperty(`/fields/${iSelectedIndex}/key`);
      oFilterModel.setProperty("/selectedField", sSelectedKey);
    },

    _applyFiltersAndSort: function () {
      const oFilterData = this.getView().getModel("filter").getData();
      const sQuery = oFilterData.searchQuery.toLowerCase();
      let aFiltered = [...this._aAllItems];

      // 1. Aplicar filtro de búsqueda
      if (sQuery) {
        const sSelectedField = oFilterData.selectedField;
        aFiltered = aFiltered.filter(item => {
          return item[sSelectedField] && item[sSelectedField].toString().toLowerCase().includes(sQuery);
        });
      }

      // 2. Aplicar ordenamiento
      const oSortInfo = oFilterData.sort;
      const sSortField = oSortInfo.selectedField;

      aFiltered.sort((a, b) => {
        let valA = a[sSortField];
        let valB = b[sSortField];

        // Manejo para fechas
        if (sSortField === "FECHAREG" && a.FECHAREG) {
          valA = new Date(a.FECHAREG + "T" + a.HORAREG);
        }
        if (sSortField === "FECHAREG" && b.FECHAREG) {
          valB = new Date(b.FECHAREG + "T" + b.HORAREG);
        }
        if (sSortField === "FECHAULTMOD" && a.FECHAULTMOD) {
          valA = new Date(a.FECHAULTMOD + "T" + a.HORAULTMOD);
        }
        if (sSortField === "FECHAULTMOD" && b.FECHAULTMOD) {
          valB = new Date(b.FECHAULTMOD + "T" + b.HORAULTMOD);
        }

        let comparison = 0;
        if (valA > valB) {
          comparison = 1;
        } else if (valA < valB) {
          comparison = -1;
        }

        return (oSortInfo.direction === "DESC") ? (comparison * -1) : comparison;
      });

      // 3. Actualizar datos para paginación
      this._aFilteredItems = aFiltered;
      this._iCurrentPage = 1; // Siempre volver a la primera página después de filtrar
      this._updateTablePage();
    },

    // ==== Popover para Información Adicional ====
    _getInfoAdPopover: function () {
      if (!this._oInfoAdPopover) {
        this._oInfoAdPopover = Fragment.load({
          id: this.getView().getId(),
          name: "com.itt.ztgruposet.frontendztgruposet.view.fragments.InfoAdPopover",
          controller: this
        }).then(oPopover => {
          this.getView().addDependent(oPopover);
          return oPopover;
        });
      }
      return this._oInfoAdPopover;
    },

    onInfoAdPress: function (oEvent) {
      const oControl = oEvent.getSource();
      const oContext = oControl.getBindingContext("grupos");
      const sInfoCompleta = oContext.getProperty("INFOAD");
      this.getView().getModel("infoAd").setProperty("/text", sInfoCompleta);
      this._getInfoAdPopover().then(oPopover => oPopover.openBy(oControl));
    },

    // ==== LÓGICA DE PAGINACIÓN PERSONALIZADA ====
    onNavPage: function (oEvent) {
      const sNavDirection = oEvent.getSource().getIcon().includes("right") ? "next" : "prev";

      if (sNavDirection === "next") {
        this._iCurrentPage++;
      } else {
        this._iCurrentPage--;
      }

      this._updateTablePage();
    },

    //PAGINACION COMENTADA

    /* _updateTablePage: function () {
      const oView = this.getView();
      const iTotalItems = this._aFilteredItems.length;
      const iTotalPages = Math.ceil(iTotalItems / this._iPageSize);

      // Asegurarse de que la página actual esté dentro de los límites
      this._iCurrentPage = iTotalPages === 0 ? 1 : Math.max(1, Math.min(this._iCurrentPage, iTotalPages));

      const iStartIndex = (this._iCurrentPage - 1) * this._iPageSize;
      const iEndIndex = iStartIndex + this._iPageSize;
      const aPageItems = this._aFilteredItems.slice(iStartIndex, iEndIndex);

      // Actualizar el modelo de la tabla con solo los registros de la página actual
      oView.getModel("grupos").setData({ items: aPageItems });

      // Actualizar estado de los botones y texto informativo
      oView.byId("btnPrevPage").setEnabled(this._iCurrentPage > 1);
      oView.byId("btnNextPage").setEnabled(this._iCurrentPage < iTotalPages);

      const oGruposModel = oView.getModel("grupos");
        aPageItems.forEach((item, idx) => {
          oGruposModel.setProperty(`/items/${idx}/EditVisible`, false);
        });

        oView.byId("btnPrevPage").setEnabled(this._iCurrentPage > 1);
        oView.byId("btnNextPage").setEnabled(this._iCurrentPage < iTotalPages);

      if (iTotalItems > 0) {
        oView.byId("txtPageInfo").setText(`Mostrando ${iStartIndex + 1} - ${Math.min(iEndIndex, iTotalItems)} de ${iTotalItems}`);
      } else {
        oView.byId("txtPageInfo").setText("No hay registros");
      }
    },
    */

    //PAGINACION SIN PAGINAS
    _updateTablePage: function () {
      const oView = this.getView();

      // 👉 En vez de hacer el slice por página, usamos TODO el arreglo filtrado
      const aItems = this._aFilteredItems || this._aAllItems || [];

      // Poner todos los registros en el modelo de la tabla
      oView.getModel("grupos").setData({ items: aItems });

      // 👉 Ocultar / deshabilitar controles de paginación
      if (oView.byId("btnPrevPage")) {
        oView.byId("btnPrevPage").setVisible(false);
      }
      if (oView.byId("btnNextPage")) {
        oView.byId("btnNextPage").setVisible(false);
      }
      if (oView.byId("txtPageInfo")) {
        oView.byId("txtPageInfo").setVisible(false);
      }
    },

    _resetEtiquetaCombo: function () {
      const oView = this.getView();
      const oCascade = oView.getModel("cascadeModel");
      const oCreate = oView.getModel("createModel");

      const etiquetasAll = oCascade.getProperty("/etiquetasAll") || [];
      const selectedSoc = oCreate.getProperty("/IDSOCIEDAD");
      const selectedCedi = oCreate.getProperty("/IDCEDI");

      // Si hay Soc/Cedi seleccionados, filtrar por ellos; si no, mostrar todo
      const base = etiquetasAll.filter(e => {
        if (selectedSoc && selectedCedi) {
          return String(e.IDSOCIEDAD) === String(selectedSoc) &&
            String(e.IDCEDI) === String(selectedCedi);
        }
        return true;
      });

      // Mapear al formato que espera el ComboBox
      const mapped = base.map(e => ({
        key: e.IDETIQUETA || e.key || e._id || e.ID,
        text: e.ETIQUETA || e.text || e.IDETIQUETA,
        IDSOCIEDAD: e.IDSOCIEDAD,
        IDCEDI: e.IDCEDI
      }));

      oCascade.setProperty("/etiquetas", mapped);
    },

    onEtiquetaFilterPress: function () {
      const oFilterModel = this.getView().getModel("etiquetaFilterModel");

      // obtener última selección (default ALL si no existe)
      const lastRange = oFilterModel.getProperty("/selectedDateRange") || "ALL";

      // si el dialog NO existe → cargarlo
      if (!this._oEtiquetaFilterDialog) {
        Fragment.load({
          id: this.getView().getId() + "--etiquetaFilter",
          name: "com.itt.ztgruposet.frontendztgruposet.view.fragments.EtiquetaFilterDialog",
          controller: this
        }).then((oDialog) => {

          this._oEtiquetaFilterDialog = oDialog;
          this.getView().addDependent(oDialog);

          // cargar listas internas del filtro
          this._loadEtiquetaFilters();

          // restaurar etiquetas para que el combo no quede vacío
          this._resetEtiquetaCombo();

          // aplicar la última fecha seleccionada al combo del dialog
          const oDateCombo = this.byId("etiquetaFilter--etiquetaFilterDate");
          if (oDateCombo) {
            oDateCombo.setSelectedKey(lastRange);
          }

          oDialog.open();
        }).catch(err => console.error("Error cargando fragment etiquetaFilter:", err));

      } else {
        // ya existe → solo recargar listas y restaurar fecha
        this._loadEtiquetaFilters();
        this._resetEtiquetaCombo();

        // restaurar selección anterior en el combo de fecha
        const oDateCombo = this.byId("etiquetaFilter--etiquetaFilterDate");
        if (oDateCombo) {
          oDateCombo.setSelectedKey(lastRange);
        }

        this._oEtiquetaFilterDialog.open();
      }
    },


    _loadEtiquetaFilters: function () {
      const oCascade = this.getView().getModel("cascadeModel");
      const oFilterModel = this.getView().getModel("etiquetaFilterModel");

      const etiquetasAll = oCascade.getProperty("/etiquetasAll") || [];

      // Colecciones únicas
      const colecciones = [...new Set(etiquetasAll.map(e => e.COLECCION))]
        .filter(v => v)
        .map(v => ({ text: v }));

      // Secciones únicas
      const secciones = [...new Set(etiquetasAll.map(e => e.SECCION))]
        .filter(v => v)
        .map(v => ({ text: v }));

      oFilterModel.setProperty("/colecciones", colecciones);
      oFilterModel.setProperty("/secciones", secciones);
    },

    onCancelEtiquetaFilters: function () {
      const oFilterModel = this.getView().getModel("etiquetaFilterModel");
      if (oFilterModel) oFilterModel.setProperty("/selectedDateRange", "ALL");

      // repoblar etiquetas con la vista actual (evitar que al reabrir quede vacío)
      this._resetEtiquetaCombo();

      if (this._oEtiquetaFilterDialog && this._oEtiquetaFilterDialog.isOpen()) {
        this._oEtiquetaFilterDialog.close();
      }
    },

    _getRecordDate: function (item) {
      // 1) Si viene crudo desde BD dentro de _raw
      const raw = item._raw || item;

      // 2) DETAIL_ROW > CURRENT
      try {
        if (raw.DETAIL_ROW?.DETAIL_ROW_REG) {
          const curr = raw.DETAIL_ROW.DETAIL_ROW_REG.find(r => r.CURRENT);
          if (curr?.REGDATE) {
            const d = new Date(curr.REGDATE);
            if (!isNaN(d)) return d;
          }
        }
      } catch (e) { }

      // 3) updatedAt
      if (raw.updatedAt) {
        const d = new Date(raw.updatedAt);
        if (!isNaN(d)) return d;
      }

      // 4) createdAt
      if (raw.createdAt) {
        const d = new Date(raw.createdAt);
        if (!isNaN(d)) return d;
      }

      return null;
    },
    _filterByMonths: function (iMonths) {
      const oCascadeModel = this.getView().getModel("cascadeModel");
      const aAllItems = oCascadeModel.getProperty("/etiquetasAll");

      const today = new Date();
      const limitDate = new Date();
      limitDate.setMonth(limitDate.getMonth() - iMonths);

      const aFiltered = aAllItems.filter(item => {
        const d = this._getRecordDate(item);
        console.log("Etiqueta:", item.IDETIQUETA, "Fecha detectada:", d);
        return d && d >= limitDate;
      });

      oCascadeModel.setProperty("/etiquetas", aFiltered);

    },
    onFechaSelectionChange: function (oEvent) {
      const key = oEvent.getSource().getSelectedKey();

      const oFilterModel = this.getView().getModel("etiquetaFilterModel");
      oFilterModel.setProperty("/selectedDateRange", key);

      this._applyEtiquetaFilters();
    },

    _applyEtiquetaFilters: async function () {
      const oCascade     = this.getView().getModel("cascadeModel");
      const oFilterModel = this.getView().getModel("etiquetaFilterModel");

      // 🔹 Elegir de qué modelo leer SOC / CEDI según el contexto
      let oContextModel;
      if (this._currentEditContext === "update") {
        oContextModel = this.getView().getModel("updateModel");
      } else if (this._currentEditContext === "inline") {
        oContextModel = this.getView().getModel("inlineEdit");
      } else { // default: create
        oContextModel = this.getView().getModel("createModel");
      }

      // 🔹 Leer Sociedad / CEDI según el modelo
      let selectedSoc, selectedCedi;
      if (this._currentEditContext === "inline") {
        selectedSoc  = oContextModel.getProperty("/current/IDSOCIEDAD");
        selectedCedi = oContextModel.getProperty("/current/IDCEDI");
      } else {
        selectedSoc  = oContextModel.getProperty("/IDSOCIEDAD");
        selectedCedi = oContextModel.getProperty("/IDCEDI");
      }

      // obtener copia completa (no mapear -> preservar fechas)
      let etiquetasAll = oCascade.getProperty("/etiquetasAll") || [];

      if (!Array.isArray(etiquetasAll) || etiquetasAll.length === 0) {
        try {
          await this._loadExternalCatalogData();
          etiquetasAll = this.getView()
            .getModel("cascadeModel")
            .getProperty("/etiquetasAll") || [];
        } catch (e) {
          console.warn("No se pudo cargar etiquetasAll automáticamente:", e);
        }
      }

      if (!selectedSoc || !selectedCedi) {
        MessageToast.show("Selecciona Sociedad y CEDI antes de aplicar filtros.");
        return;
      }

      // colecciones y secciones
      const oColeccionList = this.byId("etiquetaFilter--coleccionFilterList");
      const oSeccionList   = this.byId("etiquetaFilter--seccionFilterList");
      const coleccionItems = oColeccionList ? oColeccionList.getSelectedItems() : [];
      const seccionItems   = oSeccionList ? oSeccionList.getSelectedItems() : [];
      const coleccionesSel = coleccionItems.map(i => i.getTitle());
      const seccionesSel   = seccionItems.map(i => i.getTitle());

      // filtro base por Soc/Cedi
      let filtered = etiquetasAll.filter(e =>
        String(e.IDSOCIEDAD) === String(selectedSoc) &&
        String(e.IDCEDI)     === String(selectedCedi)
      );

      if (coleccionesSel.length > 0) {
        filtered = filtered.filter(e => coleccionesSel.includes(e.COLECCION || ""));
      }
      if (seccionesSel.length > 0) {
        filtered = filtered.filter(e => seccionesSel.includes(e.SECCION || ""));
      }

      // RANGO DE FECHA
      const dateRange = oFilterModel.getProperty("/selectedDateRange") || "ALL";
      if (dateRange !== "ALL") {
        const months = parseInt(String(dateRange).replace("M", ""), 10);
        if (!isNaN(months)) {
          const now   = new Date();
          const limit = new Date(now.getTime());
          limit.setMonth(limit.getMonth() - months);

          filtered = filtered.filter(e => {
            const d = this._getRecordDate(e);
            return d && d >= limit;
          });
        }
      }

      // Aplicar resultado al combo
      oCascade.setProperty("/etiquetas", filtered);

      // reset seleccionado visual del combo
      if (this._currentEditContext === "inline") {
        this.getView().getModel("inlineEdit").setProperty("/current/IDETIQUETA", null);
      } else if (this._currentEditContext === "update") {
        this.getView().getModel("updateModel").setProperty("/IDETIQUETA", null);
      } else {
        this.getView().getModel("createModel").setProperty("/IDETIQUETA", null);
      }
    },

    _refreshTable: function () {
      const oTable = this.byId("idTabla"); // ID real
      const oModel = new JSONModel(this._aFilteredItems);

      oTable.setModel(oModel, "tableModel");
    },

    // === GRUPO ET para el modal de CREAR ===
    onOpenGrupoEt: function () {
      const oView   = this.getView();
      const oCreate = oView.getModel("createModel");
      const oEdit   = oView.getModel("editModel"); // <<-- pon aquí tu modelo de edición

      // 1) Obtener Sociedad / CEDI
      let sSoc  = oCreate && oCreate.getProperty("/IDSOCIEDAD");
      let sCedi = oCreate && oCreate.getProperty("/IDCEDI");
      let sMode = "create";

      // Si no vienen del createModel, intentamos desde el modelo de edición
      if (!sSoc || !sCedi) {
        sSoc  = oEdit && oEdit.getProperty("/IDSOCIEDAD");
        sCedi = oEdit && oEdit.getProperty("/IDCEDI");
        sMode = "update";
      }

      if (!sSoc || !sCedi) {
        sap.m.MessageToast.show("Selecciona primero Sociedad y CEDI.");
        return;
      }

      // Guardamos modo para luego (por si lo usas en onApplyGrupoEt)
      this._grupoEtEditMode = sMode;

      const oCascade = oView.getModel("cascadeModel");
      const oGM      = oView.getModel("grupoEtModel");

      // TODAS las etiquetas completas
      const aAllEtiquetas = oCascade.getProperty("/etiquetasAll") || [];

      // Solo las de esa Sociedad + CEDI
      const aFiltradas = aAllEtiquetas.filter(e =>
        String(e.IDSOCIEDAD) === String(sSoc) &&
        String(e.IDCEDI)     === String(sCedi)
      );

      // Mapeo para el combo
      const aComboItems = aFiltradas.map(e => {
        const sTxt =
          (e.text && String(e.text).trim()) ||
          (e.ALIAS && e.ALIAS.trim()) ||
          (e.ETIQUETA && e.ETIQUETA.trim()) ||
          e.IDETIQUETA;

        return {
          IDETIQUETA:   e.IDETIQUETA,       // ID real -> key del ComboBox
          ETIQUETA:     sTxt,               // texto mostrado
          text:        sTxt, 
          ALIAS:        e.ALIAS || "",
          RAW_ETIQUETA: e.text || e.ETIQUETA
        };
      });

      // Set al modelo del diálogo
      oGM.setProperty("/etiquetas", aComboItems);
      oGM.setProperty("/selectedEtiqueta", null);
      oGM.setProperty("/selectedValor", null);
      oGM.setProperty("/valoresList", []);
      oGM.setProperty("/displayName", "");

      // Abrir / crear el fragmento
      if (!this._oGrupoEtDialog) {
        sap.ui.core.Fragment.load({
          id: oView.getId() + "--grupoEtDialog",
          name: "com.itt.ztgruposet.frontendztgruposet.view.fragments.GrupoEtDialog",
          controller: this
        }).then(oDialog => {
          this._oGrupoEtDialog = oDialog;
          oView.addDependent(oDialog);
          this._setupGrupoEtDialogFilters();
          oDialog.open();
        });
      } else {
        this._setupGrupoEtDialogFilters();
        this._oGrupoEtDialog.open();
      }
    },
    // Abre el diálogo (carga fragment con id prefijado, repuebla listas y abre)

     onOpenGrupoEtInline: function () {
      const oInline = this.getView().getModel("inlineEdit");
      const sSoc  = oInline.getProperty("/current/IDSOCIEDAD");
      const sCedi = oInline.getProperty("/current/IDCEDI");

      if (!sSoc || !sCedi) {
        sap.m.MessageToast.show("Selecciona primero Sociedad y CEDI.");
        return;
      }

      this._grupoEtEditMode = "inline";

      // 1) Traemos todas las etiquetas desde cascadeModel
      const oCascade   = this.getView().getModel("cascadeModel");
      const aAllEt     = oCascade.getProperty("/etiquetasAll") || [];

      const aFiltradas = aAllEt.filter(e =>
        String(e.IDSOCIEDAD) === String(sSoc) &&
        String(e.IDCEDI)     === String(sCedi)
      ).map(e => {
              const sTxt =
              (e.text && String(e.text).trim()) ||
              (e.ALIAS && e.ALIAS.trim()) ||
              (e.ETIQUETA && e.ETIQUETA.trim()) ||
              e.IDETIQUETA;

          return {
              IDETIQUETA:  e.IDETIQUETA,   // ID real
              ETIQUETA:    sTxt,           // por si lo usas en filtros
              text:        sTxt,           // ESTA ES LA CLAVE
              ALIAS:       e.ALIAS || "",
              RAW_ETIQUETA: e.text || e.ETIQUETA
          };
      });

      // 2) Pero las guardamos en grupoEtModel (el que usa el fragmento)
      const oGrupoEtModel = this.getView().getModel("grupoEtModel");
      oGrupoEtModel.setProperty("/etiquetas", aFiltradas);

      
      oGrupoEtModel.setProperty("/selectedEtiqueta", "");  // opcional
      oGrupoEtModel.setProperty("/valoresList", []);       // limpia valores
      oGrupoEtModel.setProperty("/selectedValor", "");     // opcional
      oGrupoEtModel.setProperty("/displayName", "");       // opcional

      // 3) Precargar datos para modo inline, si lo necesitas
      this._preloadGrupoEtForInline();

      // 4) Abrir diálogo
      if (!this._oGrupoEtDialog) {
        sap.ui.core.Fragment.load({
          id: this.getView().getId() + "--grupoEtDialog",
          name: "com.itt.ztgruposet.frontendztgruposet.view.fragments.GrupoEtDialog",
          controller: this
        }).then(oDialog => {
          this._oGrupoEtDialog = oDialog;
          this.getView().addDependent(oDialog);
          this._setupGrupoEtDialogFilters();
          oDialog.open();
        });
      } else {
        this._setupGrupoEtDialogFilters();
        this._oGrupoEtDialog.open();
      }
    },

            /**
       * Configura los filtros de los ComboBox del diálogo "Definir Grupo ET"
       * para que filtren por cualquier parte del texto y por varias columnas.
       */
      _setupGrupoEtDialogFilters: function () {
        // === Combo de ETIQUETA ===
        const oCbEtiqueta = this.byId("grpEtiqueta");
        if (oCbEtiqueta && !oCbEtiqueta._bFilterConfigured) {
          oCbEtiqueta.setFilterFunction(function (sTerm, oItem) {
            if (!sTerm) { return true; }

            const sQuery = sTerm.toLowerCase();
            const oCtx   = oItem.getBindingContext("grupoEtModel");
            if (!oCtx) { return false; }

            const oData = oCtx.getObject();

            // Campos que quieres que entren en la búsqueda
            const sEtiqueta   = (oData.ETIQUETA   || "").toLowerCase();
            const sIdEtiqueta = (oData.IDETIQUETA || "").toLowerCase();
            const sIndice     = (oData.INDICE     || "").toLowerCase();   // por si quieres también INDICE

            const sFullText = [sEtiqueta, sIdEtiqueta, sIndice].join(" ");

            return sFullText.indexOf(sQuery) !== -1;
          });

          // banderita para no volver a configurarlo
          oCbEtiqueta._bFilterConfigured = true;
        }

        // === Combo de VALOR ===
        const oCbValor = this.byId("grpEtValor");
        if (oCbValor && !oCbValor._bFilterConfigured) {
          oCbValor.setFilterFunction(function (sTerm, oItem) {
            if (!sTerm) { return true; }

            const sQuery = sTerm.toLowerCase();
            const oCtx   = oItem.getBindingContext("grupoEtModel");
            if (!oCtx) { return false; }

            const oData = oCtx.getObject();

            // Campos para el valor
            const sValor       = (oData.VALOR       || "").toLowerCase();
            const sIdValor     = (oData.IDVALOR     || "").toLowerCase();
            const sAlias       = (oData.ALIAS       || "").toLowerCase();
            const sDescripcion = (oData.DESCRIPCION || "").toLowerCase();

            const sFullText = [sValor, sIdValor, sAlias, sDescripcion].join(" ");

            return sFullText.indexOf(sQuery) !== -1;
          });

          oCbValor._bFilterConfigured = true;
        }
      },

    // Cuando seleccionan la Etiqueta dentro del modal -> cargar valores en grupoEtModel>/valoresList
    onGrupoEtiquetaChange: function (oEvent) {
        // ID de la etiqueta seleccionada (key del ComboBox "Grupo ET - Etiqueta")
        const sSelectedEtiquetaId = oEvent.getSource().getSelectedKey();

        const oView    = this.getView();
        const oGM      = oView.getModel("grupoEtModel");
        const oCascade = oView.getModel("cascadeModel");

        // ==============================
        // 1) Elegir de qué modelo leer contexto (create / update / inline)
        // ==============================
        let oContextModel;
        if (this._grupoEtEditMode === "update") {
            oContextModel = oView.getModel("updateModel");
        } else if (this._grupoEtEditMode === "inline") {
            oContextModel = oView.getModel("inlineEdit");
        } else {                // "create" por defecto
            oContextModel = oView.getModel("createModel");
        }

        // Guardar la etiqueta seleccionada en el modelo del diálogo
        oGM.setProperty("/selectedEtiqueta", sSelectedEtiquetaId);

        // ==============================
        // 2) Leer Sociedad y CEDI según el modo
        // ==============================
        let sSoc, sCedi;
        if (this._grupoEtEditMode === "inline") {
            sSoc  = oContextModel.getProperty("/current/IDSOCIEDAD");
            sCedi = oContextModel.getProperty("/current/IDCEDI");
        } else {
            sSoc  = oContextModel.getProperty("/IDSOCIEDAD");
            sCedi = oContextModel.getProperty("/IDCEDI");
        }

        if (!sSoc || !sCedi || !sSelectedEtiquetaId) {
            oGM.setProperty("/valoresList", []);
            oGM.setProperty("/selectedValor", null);
            oGM.setProperty("/displayName", "");
            return;
        }

        // ==============================
        // 3) Filtrar los valores de ESA etiqueta + Sociedad + CEDI
        //    (valoresAll viene del cascadeModel)
        // ==============================
        const aAllVals = oCascade.getProperty("/valoresAll") || [];

        const aFiltered = aAllVals.filter(v =>
            String(v.IDSOCIEDAD)     === String(sSoc) &&
            String(v.IDCEDI)         === String(sCedi) &&
            String(v.parentEtiqueta) === String(sSelectedEtiquetaId)   // << aquí se liga a la etiqueta
        );

        // ==============================
        // 4) Mapear para mostrar KEY bonito (VALOR) y seguir guardando IDVALOR real
        // ==============================
        const aMappedVals = aFiltered.map(v => {
            const sTxt =
                (v.text && String(v.text).trim()) ||   // ← KEY del catálogo
                (v.ALIAS && v.ALIAS.trim())      ||
                (v.VALOR && v.VALOR.trim())      ||
                v.IDVALOR;

            return {
                IDVALOR:        v.IDVALOR,          // ID real
                VALOR:          sTxt,               // Texto visible en el ComboBox
                ALIAS:          v.ALIAS || "",
                RAW_VALOR:      v.text || v.VALOR,
                IDSOCIEDAD:     v.IDSOCIEDAD,
                IDCEDI:         v.IDCEDI,
                parentEtiqueta: v.parentEtiqueta
            };
        });

        // Lista para el combo "Grupo ET - Valor"
        oGM.setProperty("/valoresList", aMappedVals);

        // ==============================
        // 5) Resetear valor seleccionado y resultado
        // ==============================
        oGM.setProperty("/selectedValor", null);
        oGM.setProperty("/displayName", "");
    },
    // Pre-cargar el modelo grupoEtModel a partir del inlineEdit
    _preloadGrupoEtForInline: function () {
      const oInline  = this.getView().getModel("inlineEdit");
      const oGM      = this.getView().getModel("grupoEtModel");
      const oCascade = this.getView().getModel("cascadeModel");

      const sGrupoEt = oInline.getProperty("/current/IDGRUPOET");  // p.ej. "TURNO_OPERATIVO-TURNO_MATUTINO"

      if (!sGrupoEt || !sGrupoEt.includes("-")) {
        oGM.setProperty("/selectedEtiqueta", null);
        oGM.setProperty("/selectedValor", null);
        oGM.setProperty("/valoresList", []);
        oGM.setProperty("/displayName", "");
        return;
      }

      const [sEtiId, sValId] = sGrupoEt.split("-");

      const sSoc  = oInline.getProperty("/current/IDSOCIEDAD");
      const sCedi = oInline.getProperty("/current/IDCEDI");
      const aValsAll = oCascade.getProperty("/valoresAll") || [];

      const aFilteredVals = aValsAll.filter(v =>
        String(v.IDSOCIEDAD)     === String(sSoc) &&
        String(v.IDCEDI)         === String(sCedi) &&
        String(v.parentEtiqueta) === String(sEtiId)
      );

      const aMappedVals = aFilteredVals.map(v => {
        const sTxt =
          (v.text && String(v.text).trim()) ||
          (v.ALIAS && v.ALIAS.trim()) ||
          (v.VALOR && v.VALOR.trim()) ||
          v.IDVALOR;

        return {
          IDVALOR:        v.IDVALOR,
          VALOR:          sTxt,
          ALIAS:          v.ALIAS || "",
          RAW_VALOR:      v.text || v.VALOR,
          IDSOCIEDAD:     v.IDSOCIEDAD,
          IDCEDI:         v.IDCEDI,
          parentEtiqueta: v.parentEtiqueta
        };
      });

      oGM.setProperty("/selectedEtiqueta", sEtiId);
      oGM.setProperty("/valoresList", aMappedVals);
      oGM.setProperty("/selectedValor", sValId);
      oGM.setProperty("/displayName", sGrupoEt);
    },

    // Cuando seleccionan el Valor dentro del modal -> armar Resultado (Etiqueta-Valor) con IDs
    onGrupoValorChange: function (oEvent) {
      const oGM = this.getView().getModel("grupoEtModel");

      // ID de la etiqueta (ya se guardó en onGrupoEtiquetaChange)
      const sEtiId = oGM.getProperty("/selectedEtiqueta");
      // ID del valor seleccionado (key del ComboBox Grupo ET - Valor)
      const sValId = oEvent.getSource().getSelectedKey();

      if (!sEtiId || !sValId) {
        oGM.setProperty("/selectedValor", null);
        oGM.setProperty("/displayName", "");
        return;
      }

      // Guardar ID del valor
      oGM.setProperty("/selectedValor", sValId);

      // 👉 Resultado debe ser: IDETIQUETA-IDVALOR (IDs reales)
      const sGrupoEtId = `${sEtiId}-${sValId}`;

      // Texto que se ve en "Resultado (Etiqueta-Valor)"
      oGM.setProperty("/displayName", sGrupoEtId);

      // Nota: en onApplyGrupoEt se sigue usando selectedEtiqueta/selectedValor
      // para guardar el mismo formato IDETIQUETA-IDVALOR en IDGRUPOET.
    },

    // Aceptar: escribir en createModel>/IDGRUPOET (y cerrar)
    onApplyGrupoEt: function () {
      const oGM    = this.getView().getModel("grupoEtModel");
      const sEtiId = oGM.getProperty("/selectedEtiqueta");
      const sValId = oGM.getProperty("/selectedValor");

      if (!sEtiId || !sValId) {
        sap.m.MessageToast.show("Selecciona Etiqueta y Valor antes de aceptar.");
        return;
      }

      const sGrupoEt = `${sEtiId}-${sValId}`;

      if (this._grupoEtEditMode === "update") {
        const oUpdate = this.getView().getModel("updateModel");
        oUpdate.setProperty("/GRP_ET_IDETIQUETA", sEtiId);
        oUpdate.setProperty("/GRP_ET_IDVALOR",   sValId);
        oUpdate.setProperty("/IDGRUPOET",        sGrupoEt);

      } else if (this._grupoEtEditMode === "inline") {
        // aquí guardamos en el borrador de la fila
        const oInline = this.getView().getModel("inlineEdit");
        oInline.setProperty("/current/GRP_ET_IDETIQUETA", sEtiId); 
        oInline.setProperty("/current/GRP_ET_IDVALOR",   sValId);  
        oInline.setProperty("/current/IDGRUPOET",        sGrupoEt); 

      } else {
        // create
        const oCreate = this.getView().getModel("createModel");
        oCreate.setProperty("/GRP_ET_IDETIQUETA", sEtiId);
        oCreate.setProperty("/GRP_ET_IDVALOR",   sValId);
        oCreate.setProperty("/IDGRUPOET",        sGrupoEt);
      }

      if (this._oGrupoEtDialog) {
        this._oGrupoEtDialog.close();
      }
    },

    // Cancelar: cerrar sin cambios
    onCancelGrupoEt: function () {
      if (this._oGrupoEtDialog && this._oGrupoEtDialog.isOpen()) {
        this._oGrupoEtDialog.close();
      }
    },
    _todayStr: function () {
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    },

    _timeStr: function () {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      return `${hh}:${mm}:${ss}`;
    },

    onToggleDetailRow: async function (oEvent) {
      const oTable    = this.byId("tblGrupos");
      const oButton   = oEvent.getSource();
      const oMainItem = oButton.getParent();

      // 0. Si esta misma fila ya tiene subfila -> colapsar y salir
      const oExistingDetail = oMainItem.data("detailItem");
      if (oExistingDetail) {
        oTable.removeItem(oExistingDetail);
        oMainItem.data("detailItem", null);
        oButton.setIcon("sap-icon://slim-arrow-down");
        return;
      }

      // Cerrar cualquier otra subfila que esté abierta
      this._closeAnyInlineRow();

      // 1. Calcular el índice de la fila principal
      const iMainIndex = oTable.indexOfItem(oMainItem);

      // 2. Asegurar que los catálogos estén cargados
      if (!this._bCatalogLoaded) {
        await this._loadExternalCatalogData();
        this._bCatalogLoaded = true;
      }

      const oCtx = oMainItem.getBindingContext("grupos");
      if (!oCtx) { return; }

      const oRec = oCtx.getObject();

      // 3. Guardar ORIGINAL para el payload de UpdateOne
      this._inlineOriginal = Object.assign({}, oRec);

      // 4. Crear BORRADOR en el modelo inlineEdit (no toca el modelo "grupos")
      const oInline = this.getView().getModel("inlineEdit");
      oInline.setProperty("/current", Object.assign({}, oRec));

      // 5. Precargar cascadas (CEDI / Etiqueta / Valor) para esta fila
      this._preloadInlineCascades(oRec);

      // === CONTROLES DE LA SUBFILA ===

      // SOCIEDAD
      const oCmbSociedadInline = new ComboBox({
        width: "100%",
        items: {
          path: "cascadeModel>/sociedades",
          template: new CoreItem({
            key:  "{cascadeModel>key}",
            text: "{cascadeModel>text}"
          })
        },
        selectedKey: "{inlineEdit>/current/IDSOCIEDAD}",
        change: this.onInlineSociedadChange.bind(this)
      });

      // CEDI
      const oCmbCediInline = new ComboBox({
        width: "100%",
        items: {
          path: "cascadeModel>/cedis",
          template: new CoreItem({
            key:  "{cascadeModel>key}",
            text: "{cascadeModel>text}"
          })
        },
        selectedKey: "{inlineEdit>/current/IDCEDI}",
        change: this.onInlineCediChange.bind(this)
      });

      // ETIQUETA (usa texto amigable: ALIAS > ETIQUETA > IDETIQUETA)
      const oCmbEtiquetaInline = new ComboBox({
          width: "100%",
          items: {
              path: "cascadeModel>/etiquetas",
              template: new CoreItem({
                  key:  "{cascadeModel>IDETIQUETA}", // o {cascadeModel>key}
                  text: "{cascadeModel>text}"        // 👈 ahora sí existe
              })
          },
          selectedKey: "{inlineEdit>/current/IDETIQUETA}",
          change: this.onInlineEtiquetaChange.bind(this)
      });

      // 🔍 Filtro: busca en TODO el texto + el key (IDETIQUETA)
      oCmbEtiquetaInline.setFilterFunction(function (sTerm, oItem) {
        var sQuery = (sTerm || "").toLowerCase();
        var sText  = (oItem.getText() || "").toLowerCase(); // texto visible
        var sKey   = (oItem.getKey()  || "").toLowerCase(); // IDETIQUETA
        return sText.indexOf(sQuery) !== -1 || sKey.indexOf(sQuery) !== -1;
      });

      // 👉 ETIQUETA + botón filtro en un HBox
      const oEtiquetaInlineHBox = new sap.m.HBox({
        alignItems: "Center",
        items: [
          oCmbEtiquetaInline,
          new sap.m.Button({
            icon: "sap-icon://filter",
            type: "Transparent",
            tooltip: "Filtrar Etiquetas",
            press: this.onInlineEtiquetaFilterPress.bind(this)
          }).addStyleClass("sapUiTinyMarginBegin")
        ]
      });

      // VALOR (ComboBox con filtro custom)
      const oCmbValorInline = new ComboBox({
        width: "100%",
        items: {
          path: "cascadeModel>/valores",
          template: new CoreItem({
            key:  "{cascadeModel>IDVALOR}", // ID real del valor
            text: "{cascadeModel>text}"     // ALIAS / texto bonito del valor
          })
        },
        selectedKey: "{inlineEdit>/current/IDVALOR}"
      });

      // 🔍 Filtro: busca en VALOR e IDVALOR
      oCmbValorInline.setFilterFunction(function (sTerm, oItem) {
        var sQuery = (sTerm || "").toLowerCase();
        var sText  = (oItem.getText() || "").toLowerCase(); // "VALOR - (IDVALOR)"
        var sKey   = (oItem.getKey()  || "").toLowerCase(); // IDVALOR
        return sText.indexOf(sQuery) !== -1 || sKey.indexOf(sQuery) !== -1;
      });

      const bIsAzure = this.getView().getModel("config").getProperty("/dbServer") === "azure";

      const oIdInputInline = new sap.m.Input({
        value: "{inlineEdit>/current/ID}",
        editable: !bIsAzure   // 👈 false si es AZURE, true si es Mongo
      });

      // Subfila con todos los controles
      const oDetailItem = new sap.m.ColumnListItem({
        type: "Inactive",
        vAlign: "Middle",
        cells: [
          // Columna flechita
          new sap.m.Text({ text: "" }),

          // SOCIEDAD
          oCmbSociedadInline,

          // CEDI
          oCmbCediInline,

          // ETIQUETA (+ botón filtro)
          oEtiquetaInlineHBox,

          // VALOR
          oCmbValorInline,

          // GRUPO ET
          new sap.m.HBox({
            items: [
              new sap.m.Input({
                value: "{inlineEdit>/current/IDGRUPOET}",
                editable: false,
                width: "100%"
              }),
              new sap.m.Button({
                icon: "sap-icon://edit",
                type: "Transparent",
                tooltip: "Seleccionar Grupo ET",
                press: this.onOpenGrupoEtInline.bind(this)
              })
            ]
          }),

          // ID
          oIdInputInline,

          // INFO ADICIONAL
          new sap.m.Input({
            value: "{inlineEdit>/current/INFOAD}",
            width: "100%"
          }),

          // REGISTRO
          new sap.m.Text({
            text: "{grupos>RegistroCompleto}"
          }),

          // ÚLTIMA MODIFICACIÓN
          new sap.m.Text({
            text: "{grupos>ModificacionCompleta}"
          }),

          // BOTONES
          new sap.m.HBox({
            width: "100%",
            justifyContent: "Center", // centra el contenido en la celda
            items: [
              new sap.m.VBox({
                alignItems: "Center", // centra los botones dentro del VBox
                items: [
                  new sap.m.Button({
                    text: "Guardar",
                    type: "Emphasized",
                    press: this.onSaveInlineFromDetail.bind(this)
                  }).addStyleClass("sapUiTinyMarginBottom"), // separación

                  new sap.m.Button({
                    text: "Cancelar",
                    type: "Transparent",
                    press: this.onCancelInlineFromDetail.bind(this)
                  })
                ]
              })
            ]
          })
        ]
      });

      oDetailItem.addStyleClass("inlineDetailRow");

      // Que la subfila herede el mismo contexto de "grupos"
      oDetailItem.setBindingContext(oCtx, "grupos");

      // Insertar JUSTO debajo de la fila principal
      oTable.insertItem(oDetailItem, iMainIndex + 1);

      // Guardar referencia para poder eliminarla al colapsar
      oMainItem.data("detailItem", oDetailItem);

      // Cambiar icono a “colapsar”
      oButton.setIcon("sap-icon://slim-arrow-up");
    },


// Busca en varias propiedades del item del ComboBox (texto, key, descripción, alias, etc.)
    _filterComboByTerm: function (sTerm, oItem, aProps) {
      sTerm = (sTerm || "").toLowerCase();

      const oCtx = oItem.getBindingContext("grupoEtModel");  // <--- AQUÍ
      if (!oCtx) {
        return false;
      }

      return aProps.some(function (sProp) {
        let v = oCtx.getProperty(sProp);
        if (v === null || v === undefined) {
          return false;
        }

        v = String(v).toLowerCase();
        return v.indexOf(sTerm) !== -1; // <-- COINCIDENCIA EN CUALQUIER PARTE
      });
  },

  filterGrupoEtEtiqueta: function (sTerm, oItem) {
    // Buscar por IDETIQUETA y ETIQUETA
    return this._filterComboByTerm(sTerm, oItem, ["IDETIQUETA", "ETIQUETA", "ALIAS"]);
  },

  filterGrupoEtValor: function (sTerm, oItem) {
    // Buscar por IDVALOR, VALOR, ALIAS (si lo tienes)
    return this._filterComboByTerm(sTerm, oItem, ["IDVALOR", "VALOR", "ALIAS"]);
  },

  onSaveInlineFromDetail: async function () {
    const oInline = this.getView().getModel("inlineEdit");
    const oDraft  = oInline.getProperty("/current");   // 👈 ANTES: getData()
    const oOriginal = this._inlineOriginal;

    if (!oDraft.IDSOCIEDAD || !oDraft.IDCEDI || !oDraft.IDETIQUETA || !oDraft.IDVALOR) {
      MessageBox.error("Completa Sociedad, CEDI, Etiqueta y Valor.");
      return;
    }

    const url = this._getApiParams("UpdateOne");

    const payload = {
      IDSOCIEDAD: oOriginal.IDSOCIEDAD,
      IDCEDI:     oOriginal.IDCEDI,
      IDETIQUETA: oOriginal.IDETIQUETA,
      IDVALOR:    oOriginal.IDVALOR,
      IDGRUPOET:  oOriginal.IDGRUPOET,
      ID:         oOriginal.ID,
      data: {
        IDSOCIEDAD: oDraft.IDSOCIEDAD,
        IDCEDI:     oDraft.IDCEDI,
        IDETIQUETA: oDraft.IDETIQUETA,
        IDVALOR:    oDraft.IDVALOR,
        IDGRUPOET:  oDraft.IDGRUPOET,
        ID:         oDraft.ID,
        INFOAD:     oDraft.INFOAD,
        ACTIVO:     oDraft.ACTIVO !== false,
        BORRADO:    oDraft.BORRADO || false
      }
    };

    this.getView().setBusy(true);
    try {
      const res  = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409) {
          MessageBox.error("Ya existe un registro con esos datos. No se puede actualizar.");
          return;
        }
        throw new Error("HTTP " + res.status + (json.messageUSR ? " - " + json.messageUSR : ""));
      }

      MessageToast.show("Registro actualizado.");
      await this._loadData();   // recarga tabla (ya con cambios)
      this._closeAnyInlineRow(); // función helper para cerrar la subfila

    } catch (e) {
      console.error(e);
      MessageBox.error("Error al actualizar: " + e.message);
    } finally {
      this.getView().setBusy(false);
    }
  },

  // Cancelar → solo cerrar la subfila
  onCancelInlineFromDetail: function () {
  // simplemente cierras la subfila y limpias borrador
  this._inlineOriginal = null;
  this.getView().getModel("inlineEdit").setData({});
  this._closeAnyInlineRow();
},

  // ====== CASCADAS INLINE (subfila) =====================================

// Sociedad inline
onInlineSociedadChange: function (oEvent) {
  const sSoc = oEvent.getSource().getSelectedKey();
  const oInline   = this.getView().getModel("inlineEdit");
  const oCascade  = this.getView().getModel("cascadeModel");

  // Actualizar borrador
  oInline.setProperty("/current/IDSOCIEDAD", sSoc);
  oInline.setProperty("/current/IDCEDI", "");
  oInline.setProperty("/current/IDETIQUETA", "");
  oInline.setProperty("/current/IDVALOR", "");

  // Filtrar CEDIS
  const aCedisAll = oCascade.getProperty("/cedisAll") || [];
  const aCedis = aCedisAll.filter(c =>
    String(c.parentSoc) === String(sSoc)
  );

  oCascade.setProperty("/cedis", aCedis);
  oCascade.setProperty("/etiquetas", []);
  oCascade.setProperty("/valores", []);
},

// CEDI inline
onInlineCediChange: function (oEvent) {
  const sCedi = oEvent.getSource().getSelectedKey();
  const oInline   = this.getView().getModel("inlineEdit");
  const oCascade  = this.getView().getModel("cascadeModel");

  const sSoc = oInline.getProperty("/current/IDSOCIEDAD");

  oInline.setProperty("/current/IDCEDI", sCedi);
  oInline.setProperty("/current/IDETIQUETA", "");
  oInline.setProperty("/current/IDVALOR", "");

  if (!sSoc || !sCedi) {
    oCascade.setProperty("/etiquetas", []);
    oCascade.setProperty("/valores", []);
    return;
  }

  const aEtiquetasAll = oCascade.getProperty("/etiquetasAll") || [];
  const aEtiquetas = aEtiquetasAll.filter(e =>
    String(e.IDSOCIEDAD) === String(sSoc) &&
    String(e.IDCEDI)     === String(sCedi)
  );

  oCascade.setProperty("/etiquetas", aEtiquetas);
  oCascade.setProperty("/valores", []);
},

// Etiqueta inline
onInlineEtiquetaChange: function (oEvent) {
  const sEti = oEvent.getSource().getSelectedKey();
  const oInline   = this.getView().getModel("inlineEdit");
  const oCascade  = this.getView().getModel("cascadeModel");

  const sSoc  = oInline.getProperty("/current/IDSOCIEDAD");
  const sCedi = oInline.getProperty("/current/IDCEDI");

  oInline.setProperty("/current/IDETIQUETA", sEti);
  oInline.setProperty("/current/IDVALOR", "");

  if (!sSoc || !sCedi || !sEti) {
    oCascade.setProperty("/valores", []);
    return;
  }

  const aValoresAll = oCascade.getProperty("/valoresAll") || [];
  const aValores = aValoresAll.filter(v =>
    String(v.IDSOCIEDAD)    === String(sSoc) &&
    String(v.IDCEDI)        === String(sCedi) &&
    String(v.parentEtiqueta) === String(sEti)
  );

  oCascade.setProperty("/valores", aValores);
},

  onInlineOpenGrupoEt: function () {
    const oInline = this.getView().getModel("inlineEdit");
    const sSoc  = oInline.getProperty("/IDSOCIEDAD");
    const sCedi = oInline.getProperty("/IDCEDI");

    if (!sSoc || !sCedi) {
      sap.m.MessageToast.show("Selecciona primero Sociedad y CEDI.");
      return;
    }

    // Modo de trabajo del dialog
    this._grupoEtEditMode = "inline";

    const oCascade  = this.getView().getModel("cascadeModel");
    const aAllEt    = oCascade.getProperty("/etiquetasAll") || [];

    // Filtrar etiquetas solo para esa Sociedad / CEDI
    const aFiltradas = aAllEt.filter(e =>
      String(e.IDSOCIEDAD) === String(sSoc) &&
      String(e.IDCEDI) === String(sCedi)
    );
    oCascade.setProperty("/etiquetas", aFiltradas);

    // Precargar selección actual (si ya hay IDGRUPOET)
    this._preloadGrupoEtForInline();

    // Abrir / crear el diálogo
    if (!this._oGrupoEtDialog) {
      sap.ui.core.Fragment.load({
        id: this.getView().getId() + "--grupoEtDialog",
        name: "com.itt.ztgruposet.frontendztgruposet.view.fragments.GrupoEtDialog",
        controller: this
      }).then(oDialog => {
        this._oGrupoEtDialog = oDialog;
        this.getView().addDependent(oDialog);
        oDialog.open();
      });
    } else {
      this._oGrupoEtDialog.open();
    }
  },


//Helper para cerrar la subfila actual 
_closeAnyInlineRow: function () {
  const oTable = this.byId("tblGrupos");
  const aItems = oTable.getItems();

  aItems.forEach(function (oItem) {
    const oDetail = oItem.data && oItem.data("detailItem");
    if (oDetail) {
      oTable.removeItem(oDetail);
      oItem.data("detailItem", null);
      // restaurar icono
      const aCells = oItem.getCells();
      const oBtn = aCells[0];
      if (oBtn && oBtn.setIcon) {
        oBtn.setIcon("sap-icon://slim-arrow-down");
      }
    }
  });
},

  onColumnResize: function (oEvent) {
      const oColumn = oEvent.getParameter("column");
      const sWidth = oEvent.getParameter("width");
      console.log(`Columna redimensionada: ${oColumn.getId()}, Ancho: ${sWidth}`);

      // Opcional: Guardar en localStorage para persistencia
      // this._saveColumnWidth(oColumn.getId(), sWidth);
  }


  });
});
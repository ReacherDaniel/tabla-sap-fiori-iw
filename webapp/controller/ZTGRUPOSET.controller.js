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
  "sap/ui/core/Fragment"
], (Controller, JSONModel, Filter, FilterOperator, Dialog, Button, library, MessageBox, MessageToast, Text, Fragment) => {
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


    onAvatarPressed: function () {
      MessageToast.show("Avatar pressed!");
    },

    onLogoPressed: function () {
      MessageToast.show("Logo pressed!");
    },

    _aSearchFilters: [],
    _aDialogFilters: [],
    _aQuickFilters: [],
    _oFilterDialog: null,
    onInit() {

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
      this._iPageSize = 5;

      // Carga inicial
      this._loadData();
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

        // Normaliza/deriva campos útiles para la UI
        const normalized = items.map(x => ({
          _id: x._id,
          IDSOCIEDAD: x.IDSOCIEDAD,
          IDCEDI: x.IDCEDI,
          IDETIQUETA: x.IDETIQUETA,
          IDVALOR: x.IDVALOR,
          IDGRUPOET: x.IDGRUPOET,
          ID: x.ID,
          INFOAD: x.INFOAD,
          FECHAREG: x.FECHAREG,
          HORAREG: x.HORAREG,
          USUARIOREG: x.USUARIOREG,
          FECHAULTMOD: x.FECHAULTMOD,
          HORAULTMOD: x.HORAULTMOD,
          USUARIOMOD: x.USUARIOMOD,
          ACTIVO: x.ACTIVO,
          BORRADO: x.BORRADO,
          EstadoTxt: x.ACTIVO ? "ACTIVO" : "INACTIVO",
          EstadoUI5: x.ACTIVO ? "Success" : "Error",
          EstadoIcon: x.ACTIVO ? "sap-icon://sys-enter-2" : "sap-icon://status-negative",
          EstadoIconColor: x.ACTIVO ? "Positive" : "Negative",
          RegistroCompleto: `${x.FECHAREG || ''} ${x.HORAREG || ''} (${x.USUARIOREG || 'N/A'})`,
          ModificacionCompleta: x.FECHAULTMOD ? `${x.FECHAULTMOD} ${x.HORAULTMOD} (${x.USUARIOMOD || 'N/A'})` : 'Sin modificaciones'
        }));

        // Guardamos todos los items y configuramos la paginación inicial
        this._aAllItems = normalized;
        this.getView().setModel(new JSONModel(), "grupos"); // Creamos el modelo vacío
        this._applyFiltersAndSort(); // Aplicamos filtros/orden por defecto y mostramos la primera página

      } catch (e) {
        MessageToast.show("Error cargando datos: " + e.message);
      } finally {
        oView.setBusy(false);
        this.onSelectionChange(); // deshabilita botones de acción
      }
    },

    onSelectionChange: function () {
      const item = this.byId("tblGrupos").getSelectedItem();
      const rec = item ? item.getBindingContext("grupos").getObject() : null;

      this.byId("btnEdit").setEnabled(!!rec);
      this.byId("btnDelete").setEnabled(!!rec);
      this.byId("btnDeactivate").setEnabled(!!rec && rec.ACTIVO === true);
      this.byId("btnActivate").setEnabled(!!rec && rec.ACTIVO === false);
    },

    onRowPress: function (oEvent) {
      const rec = oEvent.getSource().getBindingContext("grupos").getObject();
      // abrir diálogo de edición, etc.
    },

    //función de búsqueda ////////////////////////////////////////////////////////////////////////////////

    onSearch1: function (oEvent) {
      var sQuery =
        oEvent.getParameter("newValue") ||
        oEvent.getParameter("query") ||
        oEvent.getSource().getValue();

      var oTable = this.byId("tblGrupos");
      var oBinding = oTable.getBinding("items");

      if (!sQuery) {
        oBinding.filter([]);
        return;
      }

      var aFilters = [];

      // 👉 Si lo que escribió puede ser número, filtramos numéricos con EQ
      if (!isNaN(sQuery)) {
        var iQuery = parseInt(sQuery, 10);

        aFilters.push(new Filter("IDSOCIEDAD", FilterOperator.EQ, iQuery));
        aFilters.push(new Filter("IDCEDI", FilterOperator.EQ, iQuery));
        aFilters.push(new Filter("ID", FilterOperator.EQ, iQuery));
      }

      // 👉 Campos STRING con Contains (sin problema)
      aFilters.push(new Filter("IDETIQUETA", FilterOperator.Contains, sQuery));


      // OR entre todos los filtros
      var oFilter = new Filter({
        filters: aFilters,
        and: false
      });

      oBinding.filter(oFilter);
    },

    onQuickFilter: function (oEvent) {
      var sKey = oEvent.getParameter("key");
      var aFilters = [];

      if (sKey === "ACT") {
        aFilters.push(new Filter("EstadoTxt", FilterOperator.EQ, "Activo"));
      } else if (sKey === "INA") {
        aFilters.push(new Filter("EstadoTxt", FilterOperator.EQ, "Inactivo"));
      }
      // sKey === "ALL" => sin filtro de estado

      // Puedes combinar con otros filtros si quieres, por ahora solo Estado:
      this.byId("tblGrupos").getBinding("items").filter(aFilters);
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
          if (res.status === 409 ) {
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
      const oModel = new sap.ui.model.json.JSONModel({
        sociedades: [],
        cedisAll: [],
        etiquetasAll: [],
        valoresAll: [],
        cedis: [],
        etiquetas: [],
        valores: []
      });
      oView.setModel(oModel, "cascadeModel");

      const oSwitchModel = this.getView().getModel("dbServerSwitch");
      const bIsAzure = oSwitchModel.getProperty("/state");

      // 2. Definimos la base de la API del "otro team" (¡Esto usa el proxy!)
      const sBaseUrl = "http://localhost:3034/api/cat/crudLabelsValues";

      // 3. Asignamos el DBServer correcto
      const sDBServer = bIsAzure ? "CosmosDB" : "MongoDB"; // <-- ¡Aquí está la magia!
      const sLoggedUser = "MIGUELLOPEZ";

      // 4. Construimos la URL final
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
          }),
        });

        const json = await res.json();
        console.log("📥 Respuesta sin parsear:", json);

        const registros = json?.data?.[0]?.dataRes || [];
        console.log("✅ DataRes procesado:", registros);

        if (!Array.isArray(registros) || registros.length === 0) {
          console.warn("⚠️ No se encontraron registros en la respuesta");
          return;
        }

        // 🔹 Construimos listas únicas
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
          if (item.IDETIQUETA && !etiquetas.some((e) => e.key === item.IDETIQUETA)) {
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

          oModel.setProperty("/etiquetas", etiquetasSimplificadas);
          oModel.setProperty("/etiquetasAll", etiquetas); // <-- GUARDAR OBJETO COMPLETO


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

        console.log("✅ Sociedades cargadas:", sociedades);
        console.log("✅ CEDIS cargados:", cedis);
        console.log("✅ Etiquetas cargadas:", etiquetas);
        console.log("✅ Valores cargados:", valores);

        // 🔹 Actualizamos el modelo
        oModel.setProperty("/sociedades", sociedades);
        oModel.setProperty("/cedisAll", cedis);
        oModel.setProperty("/etiquetasAll", etiquetas);
        oModel.setProperty("/valoresAll", valores);

      } catch (err) {
        console.error("💥 Error al cargar catálogos:", err);
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

    onUpdateOpenGrupoEt: function () {
      const oUpdate = this.getView().getModel("updateModel");
      const sSoc = oUpdate.getProperty("/IDSOCIEDAD");
      const sCedi = oUpdate.getProperty("/IDCEDI");

      if (!sSoc || !sCedi) {
        MessageToast.show("Selecciona primero Sociedad y CEDI.");
        return;
      }

      // 🔴 MARCAR CONTEXTO DE EDICIÓN
      this._grupoEtEditMode = "update";

      // 🟢 FILTRAR ETIQUETAS SEGÚN SOC + CEDI ANTES DE ABRIR EL MODAL
      const oCascade = this.getView().getModel("cascadeModel");
      const allEtiquetas = oCascade.getProperty("/etiquetasAll") || [];

      const filteredEtiquetas = allEtiquetas.filter(
        e => String(e.IDSOCIEDAD) === String(sSoc) &&
          String(e.IDCEDI) === String(sCedi)
      );

      oCascade.setProperty("/etiquetas", filteredEtiquetas);

      console.log("🔍 Etiquetas filtradas para Grupo ET Update:", filteredEtiquetas.length);

      // Abrir o crear el diálogo
      if (!this._oGrupoEtDialog) {
        Fragment.load({
          id: this.getView().getId() + "--grupoEtDialog",
          name: "com.itt.ztgruposet.frontendztgruposet.view.fragments.GrupoEtDialog",
          controller: this
        }).then(oDialog => {
          this._oGrupoEtDialog = oDialog;
          this.getView().addDependent(oDialog);

          // Pre-cargar valores actuales de IDGRUPOET si existen
          this._preloadGrupoEtForUpdate();

          oDialog.open();
        }).catch(err => console.error(err));
      } else {
        // Pre-cargar valores actuales antes de abrir
        this._preloadGrupoEtForUpdate();
        this._oGrupoEtDialog.open();
      }
    },

    _preloadGrupoEtForUpdate: function () {
      const oUpdate = this.getView().getModel("updateModel");
      const sGrupoEt = oUpdate.getProperty("/IDGRUPOET"); // Ej: "ETI001-VAL002"

      if (!sGrupoEt || !sGrupoEt.includes("-")) {
        // Si no hay valor o formato incorrecto, limpiar
        const oGM = this.getView().getModel("grupoEtModel");
        oGM.setProperty("/selectedEtiqueta", null);
        oGM.setProperty("/selectedValor", null);
        oGM.setProperty("/valoresList", []);
        oGM.setProperty("/displayName", "");
        return;
      }

      // Separar Etiqueta-Valor
      const [sEtiId, sValId] = sGrupoEt.split("-");

      const oGM = this.getView().getModel("grupoEtModel");
      const oCascade = this.getView().getModel("cascadeModel");

      // Setear etiqueta seleccionada
      oGM.setProperty("/selectedEtiqueta", sEtiId);

      // Cargar valores para esa etiqueta
      const selectedSoc = oUpdate.getProperty("/IDSOCIEDAD");
      const selectedCedi = oUpdate.getProperty("/IDCEDI");
      const valoresAll = oCascade.getProperty("/valoresAll") || [];

      const filtered = valoresAll.filter(v =>
        v.IDSOCIEDAD == selectedSoc &&
        v.IDCEDI == selectedCedi &&
        v.parentEtiqueta == sEtiId
      );

      oGM.setProperty("/valoresList", filtered);
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

    onDbServerChange: function (oEvent) {
      const bState = oEvent.getParameter("state");
      this.getView().getModel("dbServerSwitch").setProperty("/state", bState);

      this._loadData();
    },

    onDeletePress: function () {
      const rec = this._getSelectedRecord();
      if (!rec) {
        sap.m.MessageToast.show("Selecciona un registro primero.");
        return;
      }

      // Usa el mismo casing que en GetAll: 'Mongodb' o 'MongoDB'
      const url = this._getApiParams("DeleteHard");
      const payload = this._buildDeletePayload(rec);

      sap.m.MessageBox.warning(
        `Vas a ELIMINAR físicamente el grupo "${rec.IDETIQUETA}" (ID ${rec.ID}).\nEsta acción no se puede deshacer.\n\n¿Continuar?`,
        {
          title: "Confirmar eliminación definitiva",
          actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
          emphasizedAction: sap.m.MessageBox.Action.OK,
          onClose: async (act) => {
            if (act !== sap.m.MessageBox.Action.OK) return;

            this.getView().setBusy(true);
            try {
              const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)          // ← si tu API acepta solo llaves, ver nota abajo
              });
              const json = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error("HTTP " + res.status + (json.messageUSR ? " - " + json.messageUSR : ""));

              sap.m.MessageToast.show("Registro eliminado definitivamente.");
              await this._loadData();
              this.byId("tblGrupos").removeSelections(true);
              this.onSelectionChange(); // deshabilita botones
            } catch (e) {
              sap.m.MessageBox.error("No se pudo eliminar: " + e.message);
            } finally {
              this.getView().setBusy(false);
            }
          }
        }
      );
    },
    //filtro rapido ////////////////////////////////////////////////////////////////////////////////
    onQuickFilter: function (oEvent) {
      var sKey = oEvent.getParameter("key");
      this._aQuickFilters = [];

      if (sKey === "ACT") {
        this._aQuickFilters.push(new Filter("EstadoTxt", FilterOperator.EQ, "Activo"));
      } else if (sKey === "INA") {
        this._aQuickFilters.push(new Filter("EstadoTxt", FilterOperator.EQ, "Inactivo"));
      }

      this._applyAllFilters();
    },

    // ==== LÓGICA DE FILTRADO Y BÚSQUEDA ====
    onSearch1: function (oEvent) {
      var sQuery =
        oEvent.getParameter("newValue") ||
        oEvent.getParameter("query") ||
        oEvent.getSource().getValue();

      this._aSearchFilters = [];

      if (sQuery) {
        var aFilters = [];

        // 🔹 Si es número, seguimos usando búsqueda exacta
        if (!isNaN(sQuery)) {
          var iQuery = parseInt(sQuery, 10);
          aFilters.push(new Filter("IDSOCIEDAD", FilterOperator.EQ, iQuery));
          aFilters.push(new Filter("IDCEDI", FilterOperator.EQ, iQuery));
          aFilters.push(new Filter("ID", FilterOperator.EQ, iQuery));
        }

        // 🔹 Para texto, usamos Contains (coincidencia parcial)
        aFilters.push(new Filter("IDETIQUETA", FilterOperator.Contains, sQuery));
        aFilters.push(new Filter("IDVALOR", FilterOperator.Contains, sQuery));
        aFilters.push(new Filter("IDGRUPOET", FilterOperator.Contains, sQuery));
        aFilters.push(new Filter("INFOAD", FilterOperator.Contains, sQuery));
        aFilters.push(new Filter("EstadoTxt", FilterOperator.Contains, sQuery));
        // si escribes "Act" o "Inac" también te filtra por estado

        // OR entre todos esos campos
        this._aSearchFilters = [
          new Filter({ filters: aFilters, and: false })
        ];
      }

      this._applyAllFilters();   // 👉 aquí se combina con quick filter + filtros avanzados
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

    _applyAllFilters: function () {
      var oBinding = this.byId("tblGrupos").getBinding("items");

      var aAll = []
        .concat(this._aSearchFilters || [])
        .concat(this._aDialogFilters || [])
        .concat(this._aQuickFilters || []);

      oBinding.filter(aAll);  // AND entre grupos
    },

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

      var sSoc = oCore.byId(oView.createId("fSociedad")).getValue().trim();
      var sCedi = oCore.byId(oView.createId("fCedi")).getValue().trim();
      var sEti = oCore.byId(oView.createId("fEtiqueta")).getValue().trim();
      var sVal = oCore.byId(oView.createId("fValor")).getValue().trim();
      var oDRS = oCore.byId(oView.createId("fRegDate"));
      var oEstadoSB = oCore.byId(oView.createId("fEstado"));

      var oFrom = oDRS.getDateValue();
      var oTo = oDRS.getSecondDateValue();
      var sEstadoKey = oEstadoSB.getSelectedKey() || "ALL";

      var aFilters = [];

      if (sSoc && !isNaN(sSoc)) {
        aFilters.push(new Filter("IDSOCIEDAD", FilterOperator.EQ, parseInt(sSoc, 10)));
      }

      if (sCedi && !isNaN(sCedi)) {
        aFilters.push(new Filter("IDCEDI", FilterOperator.EQ, parseInt(sCedi, 10)));
      }

      if (sEti) {
        aFilters.push(new Filter("IDETIQUETA", FilterOperator.EQ, sEti));
      }

      if (sVal) {
        aFilters.push(new Filter("IDVALOR", FilterOperator.EQ, sVal));
      }

      if (oFrom && oTo) {
        aFilters.push(new Filter("REGDATE", FilterOperator.BT, oFrom, oTo));
      }

      if (sEstadoKey === "ACT") {
        aFilters.push(new Filter("EstadoTxt", FilterOperator.EQ, "Activo"));
      } else if (sEstadoKey === "INA") {
        aFilters.push(new Filter("EstadoTxt", FilterOperator.EQ, "Inactivo"));
      }

      // 🔴 AQUÍ es lo importante:
      this._aDialogFilters = aFilters;   // guardamos solo aquí
      this._applyAllFilters();

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

      // 🔴 ESTE ES EL PASO CLAVE:
      this._aDialogFilters = [];   // quitar completamente los filtros avanzados

      this._applyAllFilters();     // se quedan solo search + quick (si hay)
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

    onCancelFilters: function () {
      // Opcional: podrías resetear el modelo a su estado anterior si lo guardaste al abrir.
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

    _updateTablePage: function () {
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

      if (iTotalItems > 0) {
        oView.byId("txtPageInfo").setText(`Mostrando ${iStartIndex + 1} - ${Math.min(iEndIndex, iTotalItems)} de ${iTotalItems}`);
      } else {
        oView.byId("txtPageInfo").setText("No hay registros");
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
      const oCascade = this.getView().getModel("cascadeModel");
      const oFilterModel = this.getView().getModel("etiquetaFilterModel");
      const oCreateModel = this.getView().getModel("createModel");

      // obtener copia completa (no mapear -> preservar fechas)
      let etiquetasAll = oCascade.getProperty("/etiquetasAll") || [];

      console.log("📦 etiquetasAll[0] FULL:", JSON.stringify(etiquetasAll[0], null, 2));

      if (!Array.isArray(etiquetasAll) || etiquetasAll.length === 0) {
        try {
          await this._loadExternalCatalogData();
          etiquetasAll = this.getView().getModel("cascadeModel").getProperty("/etiquetasAll") || [];
        } catch (e) {
          console.warn("No se pudo cargar etiquetasAll automáticamente:", e);
        }
      }

      console.log("💾 etiquetasAll count:", etiquetasAll.length);

      const selectedSoc = oCreateModel.getProperty("/IDSOCIEDAD");
      const selectedCedi = oCreateModel.getProperty("/IDCEDI");

      if (!selectedSoc || !selectedCedi) {
        // Si quieres mostrar todo cuando falten Soc/Cedi, quita este return
        MessageToast.show("Selecciona Sociedad y CEDI antes de aplicar filtros.");
        return;
      }

      // colecciones y secciones
      const oColeccionList = this.byId("etiquetaFilter--coleccionFilterList");
      const oSeccionList = this.byId("etiquetaFilter--seccionFilterList");
      const coleccionItems = oColeccionList ? oColeccionList.getSelectedItems() : [];
      const seccionItems = oSeccionList ? oSeccionList.getSelectedItems() : [];
      const coleccionesSel = coleccionItems.map(i => i.getTitle());
      const seccionesSel = seccionItems.map(i => i.getTitle());

      // filtro base por Soc/Cedi (usar string seguro)
      let filtered = etiquetasAll.filter(e =>
        String(e.IDSOCIEDAD) === String(selectedSoc) &&
        String(e.IDCEDI) === String(selectedCedi)
      );

      console.log("Después SOC+CEDI count:", filtered.length);

      if (coleccionesSel.length > 0) {
        filtered = filtered.filter(e => coleccionesSel.includes(e.COLECCION || ""));
        console.log("Después Colección count:", filtered.length);
      }

      if (seccionesSel.length > 0) {
        filtered = filtered.filter(e => seccionesSel.includes(e.SECCION || ""));
        console.log("Después Sección count:", filtered.length);
      }

      // RANGO DE FECHA
      const dateRange = oFilterModel.getProperty("/selectedDateRange") || "ALL";
      if (dateRange !== "ALL") {
        const months = parseInt(String(dateRange).replace("M", ""), 10);
        if (isNaN(months)) {
          console.warn("selectedDateRange inválido:", dateRange);
        } else {
          // calcular límite sin mutar objeto compartido
          const now = new Date();
          const limit = new Date(now.getTime());
          limit.setMonth(limit.getMonth() - months);

          console.log("Filtrando por fecha. Límite:", limit.toISOString());

          // debug por cada item para ver qué fecha se detecta
          filtered = filtered.filter(e => {
            const d = this._getRecordDate(e);
            console.log("Comparando etiqueta:", e.IDETIQUETA || e.key || e._id,
              "-> date:", d ? d.toISOString() : null);
            return d && d >= limit;
          });

          console.log("Después Fecha count:", filtered.length);
        }
      } else {
        console.log("DateRange = ALL, no filtrar por fecha");
      }

      // Aplicar resultado al combo: **NO** mapear para no perder fechas
      // Pero el combo espera items con IDETIQUETA para key/text: lo dejamos completo y el XML usará IDETIQUETA
      oCascade.setProperty("/etiquetas", filtered);

      // reset seleccionado visual del combo (si quieres)
      this.getView().getModel("createModel").setProperty("/IDETIQUETA", null);

      console.log("Resultado final filtrado count:", filtered.length);
    },
    _refreshTable: function () {
      const oTable = this.byId("idTabla"); // ID real
      const oModel = new JSONModel(this._aFilteredItems);

      oTable.setModel(oModel, "tableModel");
    },

    // Abre el diálogo (carga fragment con id prefijado, repuebla listas y abre)
    onOpenGrupoEt: function () {
      const oCreate = this.getView().getModel("createModel");
      const sSoc = oCreate.getProperty("/IDSOCIEDAD");
      const sCedi = oCreate.getProperty("/IDCEDI");

      if (!sSoc || !sCedi) {
        MessageToast.show("Selecciona primero Sociedad y CEDI.");
        return;
      }

      // 🔴 MARCAR CONTEXTO DE CREACIÓN
      this._grupoEtEditMode = "create"; // <-- AGREGAR ESTA LÍNEA

      // Asegurarnos que /etiquetas esté repoblado para la sociedad/cedi actual
      if (this._resetEtiquetaCombo) {
        this._resetEtiquetaCombo();
      }

      if (!this._oGrupoEtDialog) {
        Fragment.load({
          id: this.getView().getId() + "--grupoEtDialog",
          name: "com.itt.ztgruposet.frontendztgruposet.view.fragments.GrupoEtDialog",
          controller: this
        }).then(oDialog => {
          this._oGrupoEtDialog = oDialog;
          this.getView().addDependent(oDialog);

          // inicializar el modelo temporal
          const oGM = this.getView().getModel("grupoEtModel");
          oGM.setProperty("/selectedEtiqueta", null);
          oGM.setProperty("/selectedValor", null);
          oGM.setProperty("/valoresList", []);
          oGM.setProperty("/displayName", "");

          oDialog.open();
        }).catch(err => console.error(err));
      } else {
        // resetear modelo antes de abrir
        const oGM = this.getView().getModel("grupoEtModel");
        oGM.setProperty("/selectedEtiqueta", null);
        oGM.setProperty("/selectedValor", null);
        oGM.setProperty("/valoresList", []);
        oGM.setProperty("/displayName", "");
        this._oGrupoEtDialog.open();
      }
    },

    // Cuando seleccionan la Etiqueta dentro del modal -> cargar valores en grupoEtModel>/valoresList
    onGrupoEtiquetaChange: function (oEvent) {
      const selectedEtiqueta = oEvent.getSource().getSelectedKey();

      // 🟢 DETECTAR CONTEXTO (Create o Update)
      const bIsUpdate = this._grupoEtEditMode === "update";
      const oContextModel = bIsUpdate ?
        this.getView().getModel("updateModel") :
        this.getView().getModel("createModel");

      const oGM = this.getView().getModel("grupoEtModel");
      const oCascade = this.getView().getModel("cascadeModel");

      const selectedSoc = oContextModel.getProperty("/IDSOCIEDAD");
      const selectedCedi = oContextModel.getProperty("/IDCEDI");

      const valoresAll = oCascade.getProperty("/valoresAll") || [];

      // Filtrar valores en cascada igual que IDVALOR normal
      const filtered = valoresAll.filter(v =>
        String(v.IDSOCIEDAD) === String(selectedSoc) &&
        String(v.IDCEDI) === String(selectedCedi) &&
        String(v.parentEtiqueta) === String(selectedEtiqueta)
      );
      // Guardar lista y limpiar selección anterior
      oGM.setProperty("/valoresList", filtered);
      oGM.setProperty("/selectedValor", null);
      oGM.setProperty("/displayName", "");
    },
    // Cuando seleccionan el Valor -> actualizar display (Etiqueta-Valor)
    onGrupoValorChange: function (oEvent) {
      const oGM = this.getView().getModel("grupoEtModel");

      const selectedEtiqueta = oGM.getProperty("/selectedEtiqueta");
      const selectedValor = oEvent.getSource().getSelectedKey();

      // Como ahora key = ID, simplemente concatenamos
      const display = selectedEtiqueta + "-" + selectedValor;

      oGM.setProperty("/selectedValor", selectedValor);
      oGM.setProperty("/displayName", display);

      console.log("✔ CAMBIO DE VALOR GRUPO ET:");
      console.log(" - Modo:", this._grupoEtEditMode);
      console.log(" - selectedEtiqueta (ID) =", selectedEtiqueta);
      console.log(" - selectedValor (ID) =", selectedValor);
      console.log(" - display =", display);
    },

    // Aceptar: escribir en createModel>/IDGRUPOET (y cerrar)
    onApplyGrupoEt: function () {
      const oGM = this.getView().getModel("grupoEtModel");
      const sEtiId = oGM.getProperty("/selectedEtiqueta");
      const sValId = oGM.getProperty("/selectedValor");

      console.log("✔ VALIDANDO:");
      console.log(" selectedEtiqueta =", sEtiId);
      console.log(" selectedValor =", sValId);
      console.log(" Modo =", this._grupoEtEditMode);

      if (!sEtiId || !sValId) {
        MessageToast.show("Selecciona Etiqueta y Valor antes de aceptar.");
        return;
      }

      const sGrupoEt = `${sEtiId}-${sValId}`;

      // 🔴 USAR LA VARIABLE DE CONTEXTO
      if (this._grupoEtEditMode === "update") {
        const oUpdate = this.getView().getModel("updateModel");
        oUpdate.setProperty("/GRP_ET_IDETIQUETA", sEtiId);
        oUpdate.setProperty("/GRP_ET_IDVALOR", sValId);
        oUpdate.setProperty("/IDGRUPOET", sGrupoEt);
        console.log("✅ Guardado en updateModel:", sGrupoEt);
      } else {
        const oCreate = this.getView().getModel("createModel");
        oCreate.setProperty("/GRP_ET_IDETIQUETA", sEtiId);
        oCreate.setProperty("/GRP_ET_IDVALOR", sValId);
        oCreate.setProperty("/IDGRUPOET", sGrupoEt);
        console.log("✅ Guardado en createModel:", sGrupoEt);
      }

      this._oGrupoEtDialog.close();
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


  });
});
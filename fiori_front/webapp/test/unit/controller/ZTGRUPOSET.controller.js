/*global QUnit*/

sap.ui.define([
	"com/itt/ztgruposet/frontendztgruposet/controller/ZTGRUPOSET.controller"
], function (Controller) {
	"use strict";

	QUnit.module("ZTGRUPOSET Controller");

	QUnit.test("I should test the ZTGRUPOSET controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});

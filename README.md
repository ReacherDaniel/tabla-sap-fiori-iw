# SKU Groups & Subgroups – Editable Table  
SAP Fiori UI5 • React • SAP CDS

This project is a collaborative **enterprise-style web application** for managing **SKU groups and subgroups** through an **editable table interface**.

The solution was developed using two different frontend technologies for comparison and learning purposes, consuming backend services built with **SAP CDS and exposed via OData**.

---

## 🧩 Project Overview

The application follows a **frontend–backend architecture** commonly used in SAP enterprise environments:

- **Frontend**
  - SAP Fiori UI5
  - React
- **Backend**
  - SAP CDS (Core Data Services)
  - OData services

The system allows business users to maintain catalog data such as SKU groups, subgroups, labels, values, and status information.

---

## 🏗️ Architecture Overview

SAP Fiori UI5 / React
        ↓
   OData Services
        ↓
     SAP CDS

---
SAP Fiori UI5 – Main Features

The SAP Fiori UI5 implementation provides a business-oriented user interface to manage SKU catalog data.

Main features include:

Editable table for SKU groups and subgroups

Toolbar actions:

Create
Edit
Delete
Activate / Deactivate
Refresh

-Column-based data visualization:
Company (Sociedad)
Branch (Sucursal / CEDIS)
Label
Value
Group Label
Status
Audit information (Created by, Modified by, timestamps)

Additional features:
Status indicators (Active / Inactive)
Search and filter controls
SAP Fiori UX patterns and design guidelines
Integration with OData services exposed by SAP CDS

Project Structure:

├── fiori_front/      # SAP Fiori UI5 implementation
├── react_front/     # React implementation
├── API_CINNALOVERS.url
├── CDS_values.rar

Technologies Used
Frontend

SAP Fiori (UI5)
React
JavaScript
MVC architecture
Component-based architecture

Backend
SAP CDS (Core Data Services)
OData services
Data modeling and service exposure

Collaboration & Contributions:

This repository is a fork of the original collaborative project, developed by multiple contributors.
My Contributions (SAP Fiori UI5)
I was responsible for the SAP Fiori UI5 implementation, including:
Design and development of the editable table
UI logic for CRUD operations
Status handling (Active / Inactive)
Data binding with OData services
Integration with SAP CDS backend
User interaction logic and validations

Original repository:
https://github.com/FranMirandaJ/tabla-editable-sap-fiori-iw

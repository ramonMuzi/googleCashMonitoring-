/**
 * Google Incentives Monitoring - Core Logic
 * IPNET Cloud - 2026
 */

// Configuration
const API_BASE_URL = '/api/incentives';

// State
let incentivesData = [];
let filteredData = [];

// DOM Elements
const loader = document.getElementById('loader');
const pipelineContainer = document.getElementById('incentive-pipeline');
const tableBody = document.getElementById('table-body');
const totalApprovedEl = document.getElementById('total-approved');
const totalPaidEl = document.getElementById('total-paid');
const paymentProgressEl = document.getElementById('payment-progress');
const activeSowsEl = document.getElementById('active-sows');

// Filter Elements
const searchInput = document.getElementById('search-input');
const typeFilter = document.getElementById('filter-type');
const investmentFilter = document.getElementById('filter-investment');
const efficiencyFilter = document.getElementById('filter-efficiency');
const statusFilter = document.getElementById('filter-status');
const yearFilter = document.getElementById('filter-year');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

async function initApp() {
    showLoader(true);
    try {
        await fetchData();
        renderDashboard();
    } catch (error) {
        console.error('Erro ao inicializar app:', error);
        alert('Erro ao carregar dados do backend. Verifique sua conexão ou credenciais.');
    } finally {
        showLoader(false);
    }
}

function setupEventListeners() {
    // Search & Filters
    [searchInput, typeFilter, investmentFilter, efficiencyFilter, statusFilter, yearFilter].forEach(el => {
        el.addEventListener('input', handleFilters);
        el.addEventListener('change', handleFilters);
    });

    // Modals
    setupModals();
}

function setupModals() {
    const modalAdd = document.getElementById('modal-add');
    const modalEdit = document.getElementById('modal-edit');
    
    // Add Modal Toggle
    document.getElementById('btn-add-record').onclick = () => modalAdd.style.display = 'flex';
    document.getElementById('close-modal').onclick = () => modalAdd.style.display = 'none';
    document.getElementById('btn-cancel').onclick = () => modalAdd.style.display = 'none';

    // Edit Modal Toggle
    document.getElementById('close-modal-edit').onclick = () => modalEdit.style.display = 'none';
    document.getElementById('btn-cancel-edit').onclick = () => modalEdit.style.display = 'none';
    
    window.onclick = (e) => {
        if (e.target == modalAdd) modalAdd.style.display = 'none';
        if (e.target == modalEdit) modalEdit.style.display = 'none';
    };

    // Add Form
    document.getElementById('add-incentive-form').onsubmit = (e) => handleFormSubmit(e, 'POST');
    
    // Edit Form
    document.getElementById('edit-incentive-form').onsubmit = (e) => handleFormSubmit(e, 'PUT');
}

async function handleFormSubmit(e, method) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    const url = method === 'POST' ? API_BASE_URL : `${API_BASE_URL}/${data['num-sow']}`;
    
    try {
        showLoader(true);
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            alert(method === 'POST' ? 'Registro adicionado!' : 'Registro atualizado!');
            form.reset();
            document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
            initApp();
        } else {
            const err = await response.json();
            alert('Erro: ' + err.error);
        }
    } catch (error) {
        alert('Erro de conexão com o servidor.');
    } finally {
        showLoader(false);
    }
}

// Data Handling
async function fetchData() {
    const response = await fetch(API_BASE_URL);
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Falha no fetch');
    }
    const data = await response.json();
    incentivesData = parseData(data);
    filteredData = [...incentivesData];
    
    populateYearFilter();
}

function parseData(rows) {
    const result = [];
    for (let i = 1; i < rows.length; i++) {
        const line = rows[i];
        if (!line || line.length < 10) continue;

        const obj = {
            tipo: line[0],
            sow: line[1],
            cliente: line[2],
            dataAprovacao: line[3],
            anoAprovacao: line[4],
            anoEntrega: line[5],
            valorAprovado: parseCurrency(line[6]),
            valorPago: parseCurrency(line[7]),
            investimentoIpnet: parseCurrency(line[8]),
            status: line[9]?.trim() || 'Ongoing',
            rawDate: line[3] // For editing
        };
        
        // Calculate percentage
        obj.porcentagem = obj.valorAprovado > 0 ? (obj.valorPago / obj.valorAprovado) * 100 : 0;
        
        result.push(obj);
    }
    return result;
}

function parseCurrency(str) {
    if (!str || typeof str !== 'string') return typeof str === 'number' ? str : 0;
    const clean = str.replace(/[R\$\s\.]/g, '').replace(',', '.');
    return parseFloat(clean) || 0;
}

function formatCurrency(val) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
}

function populateYearFilter() {
    const years = [...new Set(incentivesData.map(d => d.anoAprovacao).filter(y => y))].sort().reverse();
    yearFilter.innerHTML = '<option value="all">Todos os Anos</option>';
    years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
    });
}

// Rendering
function renderDashboard() {
    renderStats();
    renderPipeline();
    renderTable();
}

function renderStats() {
    const totalAprov = filteredData.reduce((sum, item) => sum + item.valorAprovado, 0);
    const totalPag = filteredData.reduce((sum, item) => sum + item.valorPago, 0);
    const active = filteredData.filter(item => item.status === 'Ongoing').length;

    totalApprovedEl.textContent = formatCurrency(totalAprov);
    totalPaidEl.textContent = formatCurrency(totalPag);
    activeSowsEl.textContent = active;

    const progress = totalAprov > 0 ? (totalPag / totalAprov) * 100 : 0;
    paymentProgressEl.style.width = `${Math.min(progress, 100)}%`;
}

function renderPipeline() {
    pipelineContainer.innerHTML = '';
    const displayData = filteredData.slice(0, 12);

    displayData.forEach(item => {
        const card = document.createElement('div');
        card.className = `pipeline-card ${item.status}`;
        
        const progColor = item.porcentagem > 80 ? '#f44336' : (item.porcentagem > 40 ? '#ff9800' : '#4caf50');

        card.innerHTML = `
            <div class="card-top">
                <div class="client-info">
                    <div class="client-name">${item.cliente}</div>
                    <div class="sow-id">${item.sow}</div>
                </div>
                <div class="incentive-type">${item.tipo}</div>
            </div>
            <div class="card-metrics">
                <div class="metric-row">
                    <span>Progresso Financeiro</span>
                    <span>${item.porcentagem.toFixed(1)}%</span>
                </div>
                <div class="mini-progress">
                    <div class="mini-bar" style="width: ${item.porcentagem}%; background: ${progColor}"></div>
                </div>
                ${item.investimentoIpnet > 0 ? `
                <div class="metric-row investment">
                    <span>Inv. IPNET:</span>
                    <span>${formatCurrency(item.investimentoIpnet)}</span>
                </div>` : ''}
            </div>
            <div class="card-footer">
                <div class="value-box">
                    <label>Aprovado</label>
                    <span>${formatCurrency(item.valorAprovado)}</span>
                </div>
                <div class="value-box">
                    <label>Saldo</label>
                    <span>${formatCurrency(item.valorAprovado - item.valorPago)}</span>
                </div>
            </div>
        `;
        pipelineContainer.appendChild(card);
    });
}

function renderTable() {
    tableBody.innerHTML = '';
    filteredData.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${item.cliente}</strong></td>
            <td>${item.tipo}</td>
            <td>${item.sow}</td>
            <td>${item.dataAprovacao}</td>
            <td>${formatCurrency(item.valorAprovado)}</td>
            <td>${formatCurrency(item.valorPago)}</td>
            <td>${formatCurrency(item.investimentoIpnet)}</td>
            <td><span class="status-badge ${item.status}">${item.status}</span></td>
            <td>
                <button class="btn-edit" onclick="openEditModal('${item.sow}')">Edit</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function openEditModal(sowId) {
    const item = incentivesData.find(d => d.sow === sowId);
    if (!item) return;

    document.getElementById('edit-num-sow').value = item.sow;
    document.getElementById('edit-nome-cliente').value = item.cliente;
    document.getElementById('edit-tipo-incentivo').value = item.tipo;
    document.getElementById('edit-valor-aprovado').value = item.valorAprovado;
    document.getElementById('edit-valor-pago').value = item.valorPago;
    document.getElementById('edit-ano-entrega').value = item.anoEntrega;
    document.getElementById('edit-investimento-ipnet').value = item.investimentoIpnet;
    document.getElementById('edit-status').value = item.status;
    
    // Format date for input[type="date"]
    if (item.rawDate && item.rawDate.includes('/')) {
        const parts = item.rawDate.split('/');
        if (parts.length === 3) {
            const formatted = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            document.getElementById('edit-approval-date').value = formatted;
        }
    } else {
        document.getElementById('edit-approval-date').value = item.rawDate;
    }

    document.getElementById('modal-edit').style.display = 'flex';
}

function handleFilters() {
    const search = searchInput.value.toLowerCase();
    const type = typeFilter.value;
    const investment = investmentFilter.value;
    const efficiency = efficiencyFilter.value;
    const status = statusFilter.value;
    const year = yearFilter.value;

    filteredData = incentivesData.filter(item => {
        const matchSearch = item.cliente.toLowerCase().includes(search) || 
                            item.sow.toLowerCase().includes(search);
        const matchType = type === 'all' || item.tipo === type;
        const matchStatus = status === 'all' || item.status === status;
        const matchYear = year === 'all' || item.anoAprovacao == year;
        
        const matchInv = investment === 'all' || 
                         (investment === 'yes' && item.investimentoIpnet > 0) ||
                         (investment === 'no' && item.investimentoIpnet <= 0);
                         
        const matchEff = efficiency === 'all' || 
                         (efficiency === 'high' && item.porcentagem > 80);
        
        return matchSearch && matchType && matchStatus && matchYear && matchInv && matchEff;
    });

    renderDashboard();
}

function showLoader(show) {
    loader.style.display = show ? 'flex' : 'none';
}

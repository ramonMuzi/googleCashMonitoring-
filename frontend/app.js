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
const searchInput = document.getElementById('search-input');
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
        alert('Erro ao carregar dados do backend. Certifique-se que o app.py está rodando.');
    } finally {
        showLoader(false);
    }
}

function setupEventListeners() {
    // Search
    searchInput.addEventListener('input', () => {
        handleFilters();
    });

    // Filters
    statusFilter.addEventListener('change', handleFilters);
    yearFilter.addEventListener('change', handleFilters);

    // Modal
    const btnAdd = document.getElementById('btn-add-record');
    const modal = document.getElementById('modal-add');
    const btnClose = document.getElementById('close-modal');
    const btnCancel = document.getElementById('btn-cancel');
    const form = document.getElementById('add-incentive-form');

    btnAdd.onclick = () => modal.style.display = 'flex';
    btnClose.onclick = () => modal.style.display = 'none';
    btnCancel.onclick = () => modal.style.display = 'none';
    
    window.onclick = (event) => {
        if (event.target == modal) modal.style.display = 'none';
    };

    // Form Submission
    form.onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        try {
            showLoader(true);
            const response = await fetch(API_BASE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                alert('Registro adicionado com sucesso!');
                modal.style.display = 'none';
                form.reset();
                initApp(); // Refresh data
            } else {
                const err = await response.json();
                alert('Erro ao salvar: ' + err.error);
            }
        } catch (error) {
            alert('Erro de conexão com o backend.');
        } finally {
            showLoader(false);
        }
    };
}

// Data Handling
async function fetchData() {
    const response = await fetch(API_BASE_URL);
    if (!response.ok) throw new Error('Falha no fetch');
    const data = await response.json(); // Now receiving JSON array
    incentivesData = parseData(data);
    filteredData = [...incentivesData];
    
    // Populate year filter
    const years = [...new Set(incentivesData.map(d => d.anoAprovacao).filter(y => y))].sort().reverse();
    years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
    });
}

function parseData(rows) {
    const result = [];
    
    // Skip header (i=0)
    for (let i = 1; i < rows.length; i++) {
        const currentline = rows[i];
        if (!currentline || currentline.length < 10) continue;

        const obj = {};
        obj.tipo = currentline[0];
        obj.sow = currentline[1];
        obj.cliente = currentline[2];
        obj.dataAprovacao = currentline[3];
        obj.anoAprovacao = currentline[4];
        obj.anoEntrega = currentline[5];
        obj.valorAprovado = parseCurrency(currentline[6]);
        obj.valorPago = parseCurrency(currentline[7]);
        obj.investimentoIpnet = currentline[8];
        obj.status = currentline[9]?.trim() || 'Ongoing';

        result.push(obj);
    }
    return result;
}

function parseCurrency(str) {
    if (!str) return 0;
    const clean = str.replace(/"/g, '').replace(/[R\$\s\.]/g, '').replace(',', '.');
    return parseFloat(clean) || 0;
}

function formatCurrency(val) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
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
    
    // Sort by value to show "Storytelling" of impact
    const displayData = filteredData.slice(0, 12); // Limit for storytelling focus

    displayData.forEach(item => {
        const card = document.createElement('div');
        card.className = `pipeline-card ${item.status}`;
        
        // Journey logic (0=Approved, 1=Delivery, 2=Paid)
        let step = 0;
        if (item.status === 'Complete') step = 2;
        else if (item.valorPago > 0) step = 1;

        card.innerHTML = `
            <div class="card-top">
                <div class="client-info">
                    <div class="client-name">${item.cliente}</div>
                    <div class="sow-id">${item.sow}</div>
                </div>
                <div class="incentive-type">${item.tipo}</div>
            </div>
            <div class="journey-viz">
                <div class="step ${step >= 0 ? 'done' : ''}" title="Aprovado"><span>A</span></div>
                <div class="step ${step >= 1 ? 'done' : (step === 0 ? 'active' : '')}" title="Entrega"><span>E</span></div>
                <div class="step ${step >= 2 ? 'done' : (step === 1 ? 'active' : '')}" title="Pagamento"><span>P</span></div>
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
            <td><span class="status-badge ${item.status}">${item.status}</span></td>
        `;
        tableBody.appendChild(row);
    });
}

function handleFilters() {
    const search = searchInput.value.toLowerCase();
    const status = statusFilter.value;
    const year = yearFilter.value;

    filteredData = incentivesData.filter(item => {
        const matchSearch = item.cliente.toLowerCase().includes(search) || 
                            item.sow.toLowerCase().includes(search);
        const matchStatus = status === 'all' || item.status === status;
        const matchYear = year === 'all' || item.anoAprovacao == year;
        
        return matchSearch && matchStatus && matchYear;
    });

    renderDashboard();
}

function showLoader(show) {
    loader.style.display = show ? 'flex' : 'none';
}

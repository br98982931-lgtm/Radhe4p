import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import InvoiceTemplate from '../components/InvoiceTemplate';
import WorkerReportTemplate from '../components/WorkerReportTemplate';
import t from '../translations';

const ManagerDashboard = () => {
    const { user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState('approvals');
    const [loading, setLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Data states
    const [pendingRequests, setPendingRequests] = useState([]);
    const [dealers, setDealers] = useState([]);
    const [diamondTypes, setDiamondTypes] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [analytics, setAnalytics] = useState({});
    const [employeeOfWeek, setEmployeeOfWeek] = useState(null);
    const [advancesHistory, setAdvancesHistory] = useState([]);
    const [dealerTransactions, setDealerTransactions] = useState([]);
    const [profitData, setProfitData] = useState(null);

    // Form states
    const [dealerForm, setDealerForm] = useState({ name: '', contactInfo: '' });
    const [typeForm, setTypeForm] = useState({ name: '', description: '' });
    const [advanceForm, setAdvanceForm] = useState({ worker: '', amount: '', notes: '' });
    const [workerForm, setWorkerForm] = useState({ name: '', email: '', password: '' });
    const [transactionForm, setTransactionForm] = useState({ dealer: '', diamondType: '', count: '', pricePerDiamond: '', date: '' });
    const [message, setMessage] = useState({ type: '', text: '' });

    // PDF specific states
    const [selectedDealerForInvoice, setSelectedDealerForInvoice] = useState('');
    const [invoiceData, setInvoiceData] = useState(null);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const invoiceRef = useRef(null);

    // Worker Report PDF states
    const [selectedWorkerForReport, setSelectedWorkerForReport] = useState('');
    const [workerReportData, setWorkerReportData] = useState(null);
    const [isGeneratingWorkerReport, setIsGeneratingWorkerReport] = useState(false);
    const workerReportRef = useRef(null);

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        try {
            const [requestsRes, dealersRes, typesRes, workersRes, analyticsRes, advancesRes, transactionsRes, profitRes] = await Promise.all([
                api.get('/manager/pending-requests'),
                api.get('/manager/dealers'),
                api.get('/manager/diamond-types'),
                api.get('/manager/workers'),
                api.get('/manager/analytics'),
                api.get('/manager/advances'),
                api.get('/manager/dealer-transactions'),
                api.get('/manager/profit')
            ]);

            setPendingRequests(requestsRes.data.requests);
            setDealers(dealersRes.data.dealers);
            setDiamondTypes(typesRes.data.diamondTypes);
            setWorkers(workersRes.data.workers);
            setAnalytics(analyticsRes.data.analytics);
            setAdvancesHistory(advancesRes.data.advances);
            setDealerTransactions(transactionsRes.data.transactions);
            setProfitData(profitRes.data.profit);

            const currentEmployee = workersRes.data.workers.find(w => w.isEmployeeOfWeek);
            setEmployeeOfWeek(currentEmployee || null);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const setEmployeeOfTheWeek = async (workerId) => {
        try {
            const response = await api.post('/manager/employee-of-week', { workerId });
            showMessage('success', response.data.message);
            fetchAllData();
        } catch (error) {
            showMessage('error', error.response?.data?.message || 'Failed to set employee of the week');
        }
    };

    const removeEmployeeOfWeek = async (workerId) => {
        try {
            const response = await api.delete(`/manager/employee-of-week/${workerId}`);
            showMessage('success', response.data.message);
            fetchAllData();
        } catch (error) {
            showMessage('error', t.messages.error);
        }
    };

    const approveRequest = async (id) => {
        const price = prompt(t.messages.enterPrice);
        if (!price || isNaN(price)) return;

        try {
            await api.put(`/manager/approve-request/${id}`, {
                status: 'approved',
                assignedPrice: parseFloat(price)
            });
            showMessage('success', t.messages.requestApproved);
            fetchAllData();
        } catch (error) {
            showMessage('error', error.response?.data?.message || t.messages.error);
        }
    };

    const rejectRequest = async (id) => {
        if (!confirm(t.messages.confirmReject)) return;

        try {
            await api.put(`/manager/approve-request/${id}`, { status: 'rejected' });
            showMessage('success', t.messages.requestRejected);
            fetchAllData();
        } catch (error) {
            showMessage('error', t.messages.error);
        }
    };

    const createDealer = async (e) => {
        e.preventDefault();
        try {
            await api.post('/manager/dealers', dealerForm);
            showMessage('success', t.messages.dealerCreated);
            setDealerForm({ name: '', contactInfo: '' });
            fetchAllData();
        } catch (error) {
            showMessage('error', error.response?.data?.message || t.messages.error);
        }
    };

    const toggleDealer = async (id, currentStatus) => {
        try {
            await api.put(`/manager/dealers/${id}`, { active: !currentStatus });
            fetchAllData();
        } catch (error) {
            showMessage('error', t.messages.error);
        }
    };

    const createDiamondType = async (e) => {
        e.preventDefault();
        try {
            await api.post('/manager/diamond-types', typeForm);
            showMessage('success', t.messages.typeCreated);
            setTypeForm({ name: '', description: '' });
            fetchAllData();
        } catch (error) {
            showMessage('error', error.response?.data?.message || t.messages.error);
        }
    };

    const giveAdvance = async (e) => {
        e.preventDefault();
        try {
            await api.post('/manager/advances', advanceForm);
            showMessage('success', t.messages.advanceGiven);
            setAdvanceForm({ worker: '', amount: '', notes: '' });
            fetchAllData();
        } catch (error) {
            showMessage('error', error.response?.data?.message || t.messages.error);
        }
    };

    const createWorker = async (e) => {
        e.preventDefault();
        try {
            await api.post('/auth/register', { ...workerForm, role: 'worker' });
            showMessage('success', t.messages.workerCreated);
            setWorkerForm({ name: '', email: '', password: '' });
            fetchAllData();
        } catch (error) {
            showMessage('error', error.response?.data?.message || t.messages.error);
        }
    };

    const createTransaction = async (e) => {
        e.preventDefault();
        try {
            await api.post('/manager/dealer-transactions', transactionForm);
            showMessage('success', t.messages.transactionRecorded);
            setTransactionForm({ dealer: '', diamondType: '', count: '', pricePerDiamond: '', date: '' });
            fetchAllData();
        } catch (error) {
            showMessage('error', error.response?.data?.message || t.messages.error);
        }
    };

    const generateDealerInvoicePDF = async () => {
        if (!selectedDealerForInvoice) {
            showMessage('error', t.messages.selectDealer);
            return;
        }

        const dealer = dealers.find(d => d._id === selectedDealerForInvoice);
        if (!dealer) return;

        const dealerTxns = dealerTransactions.filter(t => t.dealer?._id === selectedDealerForInvoice);
        if (dealerTxns.length === 0) {
            showMessage('error', t.messages.noTransactions);
            return;
        }

        let subtotal = 0;
        const formattedTxns = dealerTxns.map(t_txn => {
            const amount = t_txn.count * t_txn.pricePerDiamond;
            subtotal += amount;
            return {
                id: t_txn._id,
                type: t_txn.diamondType?.name || 'N/A',
                count: t_txn.count,
                price: t_txn.pricePerDiamond,
                amount: amount,
                date: new Date(t_txn.date).toLocaleDateString()
            };
        });

        const netAmount = subtotal;

        const data = {
            dealerName: dealer.name,
            transactions: formattedTxns,
            subtotal,
            netAmount
        };

        setInvoiceData(data);
        setIsGeneratingPDF(true);

        setTimeout(async () => {
            if (invoiceRef.current) {
                try {
                    const canvas = await html2canvas(invoiceRef.current, {
                        scale: 2,
                        useCORS: true,
                        logging: false
                    });

                    const imgData = canvas.toDataURL('image/png');

                    // Calculate PDF dimensions based on content
                    const pdfWidth = 210;
                    const imgWidth = canvas.width;
                    const imgHeight = canvas.height;
                    const pdfHeight = (imgHeight * pdfWidth) / imgWidth;

                    const pdf = new jsPDF('p', 'mm', [pdfWidth, pdfHeight]);
                    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

                    const safeName = dealer.name.replace(/\s+/g, '_');
                    pdf.save(`Invoice_${safeName}.pdf`);

                    showMessage('success', t.messages.pdfSuccess);
                } catch (error) {
                    console.error("Error generating PDF:", error);
                    showMessage('error', t.messages.pdfError);
                } finally {
                    setIsGeneratingPDF(false);
                }
            }
        }, 500); // Wait for React to render the template
    };

    const generateWorkerReportPDF = async () => {
        if (!selectedWorkerForReport) {
            showMessage('error', t.messages.selectWorker);
            return;
        }

        const worker = workers.find(w => w._id === selectedWorkerForReport);
        if (!worker) return;

        try {
            setIsGeneratingWorkerReport(true);
            const response = await api.get(`/manager/worker-report/${worker._id}`);
            const data = response.data;

            let totalIncome = 0;
            let totalDiamonds = 0;
            const formattedWorkLogs = data.workLogs.map(log => {
                const income = log.diamonds * log.price;
                totalIncome += income;
                totalDiamonds += log.diamonds;
                return {
                    id: log._id,
                    date: new Date(log.date).toLocaleDateString(),
                    diamonds: log.diamonds,
                    price: log.price,
                    dealer: log.dealerName,
                    income: income
                };
            });

            let totalAdvance = 0;
            const formattedAdvances = data.advances.map(adv => {
                totalAdvance += adv.amount;
                return {
                    id: adv._id,
                    date: new Date(adv.date).toLocaleDateString(),
                    remark: adv.notes,
                    amount: adv.amount
                };
            });

            const netPayable = totalIncome - totalAdvance;

            setWorkerReportData({
                workerName: worker.name,
                reportNumber: `RPT-${Math.floor(Math.random() * 100000)}`,
                date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                workLogs: formattedWorkLogs,
                advances: formattedAdvances,
                totalDiamonds,
                totalIncome,
                totalAdvance,
                netPayable
            });

            setTimeout(async () => {
                if (workerReportRef.current) {
                    try {
                        const canvas = await html2canvas(workerReportRef.current, {
                            scale: 2,
                            useCORS: true,
                            logging: false
                        });

                        const imgData = canvas.toDataURL('image/png');

                        // Calculate PDF dimensions based on content
                        const pdfWidth = 210;
                        const imgWidth = canvas.width;
                        const imgHeight = canvas.height;
                        const pdfHeight = (imgHeight * pdfWidth) / imgWidth;

                        const pdf = new jsPDF('p', 'mm', [pdfWidth, pdfHeight]);
                        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

                        const safeName = worker.name.replace(/\s+/g, '_');
                        pdf.save(`WorkerReport_${safeName}.pdf`);

                        showMessage('success', t.messages.pdfSuccess);
                    } catch (error) {
                        console.error("Error generating PDF:", error);
                        showMessage('error', t.messages.pdfError);
                    } finally {
                        setIsGeneratingWorkerReport(false);
                    }
                }
            }, 500);

        } catch (error) {
            console.error('Error fetching worker report:', error);
            showMessage('error', t.messages.pdfError);
            setIsGeneratingWorkerReport(false);
        }
    };


    // ... (existing code)

    const downloadAdvancesPDF = () => {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(20);
        doc.setTextColor(102, 126, 234);
        doc.text(t.common.appName + ' ' + t.common.systemName, 105, 15, { align: 'center' });

        doc.setFontSize(14);
        doc.setTextColor(51, 51, 51);
        doc.text(t.manager.advanceHistory, 105, 25, { align: 'center' });

        doc.setFontSize(10);
        doc.setTextColor(100);
        const dateStr = new Date().toLocaleString();
        doc.text(`${t.common.date}: ${dateStr}`, 105, 32, { align: 'center' });

        const tableColumn = [t.manager.workerName, t.common.email, t.manager.amount, t.common.date, t.manager.notes];
        const tableRows = advancesHistory.map(advance => [
            advance.worker?.name || 'N/A',
            advance.worker?.email || 'N/A',
            `Rs. ${advance.amount.toLocaleString()}`,
            new Date(advance.date).toLocaleDateString(),
            advance.notes || '-'
        ]);

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 40,
            theme: 'striped',
            headStyles: { fillColor: [102, 126, 234] },
            alternateRowStyles: { fillColor: [245, 247, 255] }
        });

        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
        }

        doc.save(`advances-report-${Date.now()}.pdf`);
    };

    const downloadAdvancesExcel = () => {
        const data = advancesHistory.map(advance => ({
            [t.manager.workerName]: advance.worker?.name || 'N/A',
            [t.common.email]: advance.worker?.email || 'N/A',
            [t.manager.amount]: advance.amount,
            [t.common.date]: new Date(advance.date).toLocaleDateString(),
            [t.manager.notes]: advance.notes || '-'
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Advances");
        XLSX.writeFile(wb, `advances-report-${Date.now()}.xlsx`);
    };

    const downloadTransactionsPDF = () => {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(20);
        doc.setTextColor(102, 126, 234);
        doc.text(t.common.appName + ' ' + t.common.systemName, 105, 15, { align: 'center' });

        doc.setFontSize(14);
        doc.setTextColor(51, 51, 51);
        doc.text(t.manager.transactionHistory, 105, 25, { align: 'center' });

        doc.setFontSize(10);
        doc.setTextColor(100);
        const dateStr = new Date().toLocaleString();
        doc.text(`${t.common.date}: ${dateStr}`, 105, 32, { align: 'center' });

        const tableColumn = [t.manager.dealer, t.manager.type, t.manager.count, t.common.price, t.common.total, t.common.date];
        const tableRows = dealerTransactions.map(t_txn => [
            t_txn.dealer?.name || 'N/A',
            t_txn.diamondType?.name || 'N/A',
            t_txn.count,
            `Rs. ${t_txn.pricePerDiamond}`,
            `Rs. ${(t_txn.totalAmount || 0).toLocaleString()}`,
            new Date(t_txn.date).toLocaleDateString()
        ]);

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 40,
            theme: 'striped',
            headStyles: { fillColor: [102, 126, 234] },
            alternateRowStyles: { fillColor: [245, 247, 255] }
        });

        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
        }

        doc.save(`transactions-report-${Date.now()}.pdf`);
    };

    const downloadTransactionsExcel = () => {
        const data = dealerTransactions.map(t_txn => ({
            [t.manager.dealer]: t_txn.dealer?.name || 'N/A',
            [t.manager.type]: t_txn.diamondType?.name || 'N/A',
            [t.manager.count]: t_txn.count,
            [t.common.price]: t_txn.pricePerDiamond,
            [t.common.total]: t_txn.totalAmount || 0,
            [t.common.date]: new Date(t_txn.date).toLocaleDateString()
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Transactions");
        XLSX.writeFile(wb, `transactions-report-${Date.now()}.xlsx`);
    };

    const downloadProfitPDF = () => {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(20);
        doc.setTextColor(102, 126, 234);
        doc.text(t.common.appName + ' ' + t.common.systemName, 105, 15, { align: 'center' });

        doc.setFontSize(14);
        doc.setTextColor(51, 51, 51);
        doc.text(t.manager.profitOverview, 105, 25, { align: 'center' });

        doc.setFontSize(10);
        doc.setTextColor(100);
        const dateStr = new Date().toLocaleString();
        doc.text(`${t.common.date}: ${dateStr}`, 105, 32, { align: 'center' });

        // Financial Summary Table
        const tableColumn = [t.messages.metric, t.manager.amount];
        const tableRows = [
            [t.manager.totalRevenue, `Rs. ${(profitData?.totalRevenue || 0).toLocaleString()}`],
            [t.manager.totalLabor, `Rs. ${(profitData?.totalLaborCost || 0).toLocaleString()}`],
            [t.manager.netProfit, `Rs. ${(profitData?.netProfit || 0).toLocaleString()}`]
        ];

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 40,
            theme: 'grid',
            headStyles: { fillColor: [40, 40, 40] },
            columnStyles: {
                0: { fontStyle: 'bold' },
                1: { title: 'Amount', halign: 'right' }
            },
            didParseCell: function (data) {
                if (data.row.index === 2 && data.section === 'body') {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.textColor = (profitData?.netProfit || 0) >= 0 ? [0, 128, 0] : [255, 0, 0];
                }
            }
        });

        // Footer
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(t.messages.confidentialReport, 105, 290, { align: 'center' });

        doc.save(`profit-report-${Date.now()}.pdf`);
    };

    const downloadProfitExcel = () => {
        const data = [{
            [t.manager.totalRevenue]: profitData?.totalRevenue || 0,
            [t.manager.totalLabor]: profitData?.totalLaborCost || 0,
            [t.manager.netProfit]: profitData?.netProfit || 0
        }];

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Profit");
        XLSX.writeFile(wb, `profit-report-${Date.now()}.xlsx`);
    };

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="dashboard-layout">
            {/* Sidebar */}
            <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <h1>{t.common.appName}</h1>
                </div>
                <div className="sidebar-nav">
                    <div className={`nav-item ${activeTab === 'approvals' ? 'active' : ''}`} onClick={() => { setActiveTab('approvals'); setIsSidebarOpen(false); }}>
                        <span>📋 {t.nav.approvals} ({pendingRequests.length})</span>
                    </div>
                    <div className={`nav-item ${activeTab === 'dealers' ? 'active' : ''}`} onClick={() => { setActiveTab('dealers'); setIsSidebarOpen(false); }}>
                        <span>🤝 {t.nav.dealers}</span>
                    </div>
                    <div className={`nav-item ${activeTab === 'transactions' ? 'active' : ''}`} onClick={() => { setActiveTab('transactions'); setIsSidebarOpen(false); }}>
                        <span>💸 {t.nav.transactions}</span>
                    </div>
                    <div className={`nav-item ${activeTab === 'profit' ? 'active' : ''}`} onClick={() => { setActiveTab('profit'); setIsSidebarOpen(false); }}>
                        <span>📈 {t.nav.profit}</span>
                    </div>
                    <div className={`nav-item ${activeTab === 'types' ? 'active' : ''}`} onClick={() => { setActiveTab('types'); setIsSidebarOpen(false); }}>
                        <span>💎 {t.nav.types}</span>
                    </div>
                    <div className={`nav-item ${activeTab === 'advances' ? 'active' : ''}`} onClick={() => { setActiveTab('advances'); setIsSidebarOpen(false); }}>
                        <span>💰 {t.nav.advances}</span>
                    </div>
                    <div className={`nav-item ${activeTab === 'employee' ? 'active' : ''}`} onClick={() => { setActiveTab('employee'); setIsSidebarOpen(false); }}>
                        <span>🏆 {t.nav.employeeOfWeek}</span>
                    </div>
                    <div className={`nav-item ${activeTab === 'add-worker' ? 'active' : ''}`} onClick={() => { setActiveTab('add-worker'); setIsSidebarOpen(false); }}>
                        <span>👤 {t.nav.addWorker}</span>
                    </div>
                </div>
                <div className="sidebar-footer">
                    <button onClick={logout} className="btn btn-secondary" style={{ width: '100%' }}>{t.common.logout}</button>
                </div>
            </div>

            {/* Mobile Overlay */}
            <div className={`mobile-overlay ${isSidebarOpen ? 'open' : ''}`} onClick={() => setIsSidebarOpen(false)}></div>

            <div className="main-content">
                {/* Navbar */}
                <div className="navbar">
                    <button className="navbar-toggle" onClick={() => setIsSidebarOpen(true)}>☰</button>
                    <div className="navbar-info">
                        <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>👨‍💼 {user.name}</span>
                    </div>
                </div>

                {message.text && (
                    <div style={{
                        padding: '12px 24px',
                        background: message.type === 'success' ? '#d1fae5' : '#fee2e2',
                        color: message.type === 'success' ? '#065f46' : '#991b1b',
                        borderRadius: '8px',
                        marginBottom: '20px',
                        fontSize: '14px',
                        textAlign: 'center'
                    }}>
                        {message.text}
                    </div>
                )}

                {/* Tab Content */}
                {activeTab === 'approvals' && (
                    <div className="card fade-in">
                        <h2>{t.manager.pendingRequests}</h2>
                        {pendingRequests.length === 0 ? <p>{t.manager.noPending}</p> : (
                            <div className="table-responsive">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>{t.manager.worker}</th><th>{t.manager.dealer}</th><th>{t.manager.type}</th><th>{t.manager.count}</th><th>{t.common.date}</th><th>{t.common.actions}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingRequests.map(request => (
                                            <tr key={request._id}>
                                                <td>{request.worker?.name}</td>
                                                <td>{request.dealer?.name}</td>
                                                <td>{request.diamondType?.name}</td>
                                                <td>{request.diamondCount}</td>
                                                <td>{new Date(request.requestDate).toLocaleDateString()}</td>
                                                <td style={{ whiteSpace: 'nowrap' }}>
                                                    <button onClick={() => approveRequest(request._id)} className="btn btn-success" style={{ padding: '6px 12px' }}>✓</button>
                                                    <button onClick={() => rejectRequest(request._id)} className="btn btn-danger" style={{ padding: '6px 12px' }}>✗</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'dealers' && (
                    <div className="grid grid-2 fade-in">
                        <div className="card">
                            <h2>{t.manager.createDealer}</h2>
                            <form onSubmit={createDealer}>
                                <div className="form-group">
                                    <label>{t.common.name}</label>
                                    <input type="text" className="form-input" value={dealerForm.name} onChange={e => setDealerForm({ ...dealerForm, name: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label>{t.manager.contactInfo}</label>
                                    <input type="text" className="form-input" value={dealerForm.contactInfo} onChange={e => setDealerForm({ ...dealerForm, contactInfo: e.target.value })} />
                                </div>
                                <button type="submit" className="btn btn-primary">{t.common.save}</button>
                            </form>
                        </div>
                        <div className="card">
                            <h2>{t.manager.allDealers}</h2>
                            <div className="table-responsive">
                                <table className="table">
                                    <thead><tr><th>{t.common.name}</th><th className="hide-mobile">{t.manager.contactInfo}</th><th>{t.common.status}</th><th>{t.common.actions}</th></tr></thead>
                                    <tbody>
                                        {dealers.map(dealer => (
                                            <tr key={dealer._id}>
                                                <td>{dealer.name}</td>
                                                <td className="hide-mobile">{dealer.contactInfo || '-'}</td>
                                                <td><span className={`badge ${dealer.active ? 'badge-success' : 'badge-danger'}`}>{dealer.active ? t.manager.active : t.manager.inactive}</span></td>
                                                <td><button onClick={() => toggleDealer(dealer._id, dealer.active)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>{dealer.active ? t.manager.deactivate : t.manager.activate}</button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'transactions' && (
                    <div className="grid grid-2 fade-in">
                        <div className="card">
                            <h2>{t.manager.recordTransaction}</h2>
                            <form onSubmit={createTransaction}>
                                <div className="form-group">
                                    <label>{t.manager.dealer}</label>
                                    <select className="form-select" value={transactionForm.dealer} onChange={e => setTransactionForm({ ...transactionForm, dealer: e.target.value })} required>
                                        <option value="">{t.manager.selectDealer}</option>
                                        {dealers.filter(d => d.active).map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>{t.manager.type}</label>
                                    <select className="form-select" value={transactionForm.diamondType} onChange={e => setTransactionForm({ ...transactionForm, diamondType: e.target.value })} required>
                                        <option value="">{t.manager.selectType}</option>
                                        {diamondTypes.filter(t => t.active).map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>{t.manager.count}</label>
                                    <input type="number" className="form-input" value={transactionForm.count} onChange={e => setTransactionForm({ ...transactionForm, count: e.target.value })} required min="1" />
                                </div>
                                <div className="form-group">
                                    <label>{t.manager.pricePerDiamond}</label>
                                    <input type="number" className="form-input" value={transactionForm.pricePerDiamond} onChange={e => setTransactionForm({ ...transactionForm, pricePerDiamond: e.target.value })} required min="0" step="0.01" />
                                </div>
                                <div className="form-group">
                                    <label>{t.manager.optionalDate}</label>
                                    <input type="date" className="form-input" value={transactionForm.date} onChange={e => setTransactionForm({ ...transactionForm, date: e.target.value })} />
                                </div>
                                <button type="submit" className="btn btn-primary">{t.manager.recordTransaction}</button>
                            </form>
                        </div>
                        <div className="card">
                            <div className="card-header-flex">
                                <h2 style={{ marginBottom: 0 }}>{t.manager.transactionHistory}</h2>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <select
                                        className="form-select"
                                        style={{ width: 'auto', padding: '6px 10px', fontSize: '13px', margin: 0 }}
                                        value={selectedDealerForInvoice}
                                        onChange={e => setSelectedDealerForInvoice(e.target.value)}
                                    >
                                        <option value="">{t.manager.selectDealerInvoice}</option>
                                        {dealers.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                                    </select>
                                    <button
                                        onClick={generateDealerInvoicePDF}
                                        className="btn btn-primary"
                                        style={{ fontSize: '13px', whiteSpace: 'nowrap' }}
                                        disabled={isGeneratingPDF}
                                    >
                                        {isGeneratingPDF ? t.manager.generating : `📄 ${t.manager.generateInvoice}`}
                                    </button>
                                </div>
                            </div>
                            <div className="table-responsive">
                                <table className="table">
                                    <thead><tr><th>{t.manager.dealer}</th><th>{t.manager.type}</th><th>{t.manager.count}</th><th>{t.manager.pricePerDiamond}</th><th>{t.common.total}</th><th>{t.common.date}</th></tr></thead>
                                    <tbody>
                                        {dealerTransactions.map(t => (
                                            <tr key={t._id}>
                                                <td>{t.dealer?.name}</td>
                                                <td>{t.diamondType?.name}</td>
                                                <td>{t.count}</td>
                                                <td>₹{t.pricePerDiamond}</td>
                                                <td>₹{(t.totalAmount || 0).toLocaleString()}</td>
                                                <td>{new Date(t.date).toLocaleDateString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'profit' && (
                    <div className="fade-in">
                        <div className="card">
                            <div className="card-header-flex">
                                <h2 style={{ marginBottom: 0 }}>{t.manager.profitOverview}</h2>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button onClick={downloadProfitPDF} className="btn btn-secondary" style={{ fontSize: '13px', padding: '6px 12px' }}>📥 PDF</button>
                                    <button onClick={downloadProfitExcel} className="btn btn-success" style={{ fontSize: '13px', padding: '6px 12px' }}>📊 Excel</button>
                                </div>
                            </div>
                            <div className="stats-grid">
                                <div className="stat-card" style={{ background: '#ecfdf5', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                                    <div className="stat-value" style={{ color: '#059669', fontSize: '24px', fontWeight: 700 }}>₹{(profitData?.totalRevenue || 0).toLocaleString()}</div>
                                    <div className="stat-label" style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>{t.manager.revenue}</div>
                                </div>
                                <div className="stat-card" style={{ background: '#fef2f2', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                                    <div className="stat-value" style={{ color: '#dc2626', fontSize: '24px', fontWeight: 700 }}>₹{(profitData?.totalLaborCost || 0).toLocaleString()}</div>
                                    <div className="stat-label" style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>{t.manager.laborCost}</div>
                                </div>
                                <div className="stat-card" style={{ background: '#eff6ff', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                                    <div className="stat-value" style={{ color: '#2563eb', fontSize: '24px', fontWeight: 700 }}>₹{(profitData?.netProfit || 0).toLocaleString()}</div>
                                    <div className="stat-label" style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>{t.manager.netProfit}</div>
                                </div>
                                <div className="stat-card" style={{ background: '#fffbeb', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                                    <div className="stat-value" style={{ color: '#d97706', fontSize: '24px', fontWeight: 700 }}>{analytics.totalWorkers}</div>
                                    <div className="stat-label" style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>{t.nav.addWorker}</div>
                                </div>
                            </div>
                        </div>
                        <div className="card" style={{ marginTop: '20px' }}>
                            <h3>Analytics</h3>
                            <div className="grid grid-2">
                                <div className="stat-card">
                                    <div className="stat-value">{analytics.totalWorkers}</div>
                                    <div className="stat-label">Total Workers</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-value">{analytics.pendingRequests}</div>
                                    <div className="stat-label">Pending Requests</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'types' && (
                    <div className="grid grid-2 fade-in">
                        <div className="card">
                            <h2>{t.manager.createType}</h2>
                            <form onSubmit={createDiamondType}>
                                <div className="form-group">
                                    <label>{t.common.name}</label>
                                    <input type="text" className="form-input" value={typeForm.name} onChange={e => setTypeForm({ ...typeForm, name: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label>{t.manager.description}</label>
                                    <input type="text" className="form-input" value={typeForm.description} onChange={e => setTypeForm({ ...typeForm, description: e.target.value })} />
                                </div>
                                <button type="submit" className="btn btn-primary">{t.common.save}</button>
                            </form>
                        </div>
                        <div className="card">
                            <h2>{t.manager.diamondTypes}</h2>
                            <div className="table-responsive">
                                <table className="table">
                                    <thead><tr><th>{t.common.name}</th><th>{t.manager.description}</th><th>{t.common.status}</th></tr></thead>
                                    <tbody>
                                        {diamondTypes.map(t_obj => (
                                            <tr key={t_obj._id}><td>{t_obj.name}</td><td>{t_obj.description || '-'}</td><td>{t_obj.active ? t.manager.active : t.manager.inactive}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'advances' && (
                    <div className="grid grid-2 fade-in">
                        <div className="card">
                            <h2>{t.manager.addAdvance}</h2>
                            <form onSubmit={giveAdvance}>
                                <div className="form-group">
                                    <label>{t.manager.worker}</label>
                                    <select className="form-select" value={advanceForm.worker} onChange={e => setAdvanceForm({ ...advanceForm, worker: e.target.value })} required>
                                        <option value="">{t.manager.selectWorker}</option>
                                        {workers.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>{t.manager.amount} (₹)</label>
                                    <input type="number" className="form-input" value={advanceForm.amount} onChange={e => setAdvanceForm({ ...advanceForm, amount: e.target.value })} required min="1" />
                                </div>
                                <div className="form-group">
                                    <label>{t.manager.notes}</label>
                                    <input type="text" className="form-input" value={advanceForm.notes} onChange={e => setAdvanceForm({ ...advanceForm, notes: e.target.value })} />
                                </div>
                                <button type="submit" className="btn btn-primary">{t.manager.addAdvance}</button>
                            </form>
                        </div>
                        <div className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <h2>{t.manager.advanceHistory}</h2>
                                <div>
                                    <button onClick={downloadAdvancesPDF} className="btn btn-secondary" style={{ fontSize: '13px', marginRight: '5px' }}>📥 PDF</button>
                                    <button onClick={downloadAdvancesExcel} className="btn btn-success" style={{ fontSize: '13px' }}>📊 Excel</button>
                                </div>
                            </div>
                            <div className="table-responsive" style={{ maxHeight: '400px' }}>
                                <table className="table">
                                    <thead><tr><th>{t.manager.worker}</th><th>{t.manager.amount}</th><th>{t.common.date}</th><th className="hide-mobile">{t.manager.notes}</th></tr></thead>
                                    <tbody>
                                        {advancesHistory.map(a => (
                                            <tr key={a._id}>
                                                <td>{a.worker?.name}</td>
                                                <td style={{ fontWeight: 'bold', color: '#dc2626' }}>₹{a.amount}</td>
                                                <td>{new Date(a.date).toLocaleDateString()}</td>
                                                <td className="hide-mobile">{a.notes || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'employee' && (
                    <div className="card fade-in">
                        <div className="card-header-flex">
                            <h2 style={{ marginBottom: 0 }}>🏆 {t.manager.employeeOfTheWeek}</h2>

                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#f3f4f6', padding: '10px', borderRadius: '8px', flexWrap: 'wrap' }}>
                                <select
                                    className="form-select"
                                    style={{ width: 'auto', padding: '6px 10px', fontSize: '13px', margin: 0 }}
                                    value={selectedWorkerForReport}
                                    onChange={e => setSelectedWorkerForReport(e.target.value)}
                                >
                                    <option value="">{t.manager.selectWorker}</option>
                                    {workers.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
                                </select>
                                <button
                                    onClick={generateWorkerReportPDF}
                                    className="btn btn-primary"
                                    style={{ fontSize: '13px', whiteSpace: 'nowrap' }}
                                    disabled={isGeneratingWorkerReport}
                                >
                                    {isGeneratingWorkerReport ? t.manager.generating : `📄 ${t.worker.downloadReport}`}
                                </button>
                            </div>
                        </div>

                        {employeeOfWeek && (
                            <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '20px', borderRadius: '10px', textAlign: 'center', marginBottom: '20px' }}>
                                <h3 style={{ margin: 0 }}>{employeeOfWeek.name}</h3>
                                <p>{employeeOfWeek.email}</p>
                                <button onClick={() => removeEmployeeOfWeek(employeeOfWeek._id)} className="btn" style={{ marginTop: '10px', background: 'rgba(255,255,255,0.2)', color: 'white' }}>{t.manager.removeEmployee}</button>
                            </div>
                        )}
                        <div className="table-responsive">
                            <table className="table">
                                <thead><tr><th>{t.common.name}</th><th className="hide-mobile">{t.manager.email}</th><th>{t.common.actions}</th></tr></thead>
                                <tbody>
                                    {workers.map(w => (
                                        <tr key={w._id}>
                                            <td>{w.name}</td>
                                            <td className="hide-mobile">{w.email}</td>
                                            <td>
                                                {!w.isEmployeeOfWeek && <button onClick={() => setEmployeeOfTheWeek(w._id)} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>{t.manager.setEmployee}</button>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'add-worker' && (
                    <div className="card fade-in" style={{ maxWidth: '600px' }}>
                        <h2>{t.manager.workerRegistration}</h2>
                        <form onSubmit={createWorker}>
                            <div className="form-group"><label>{t.manager.workerName}</label><input type="text" className="form-input" value={workerForm.name} onChange={e => setWorkerForm({ ...workerForm, name: e.target.value })} required /></div>
                            <div className="form-group"><label>{t.common.email}</label><input type="email" className="form-input" value={workerForm.email} onChange={e => setWorkerForm({ ...workerForm, email: e.target.value })} required /></div>
                            <div className="form-group"><label>{t.common.password}</label><input type="password" className="form-input" value={workerForm.password} onChange={e => setWorkerForm({ ...workerForm, password: e.target.value })} required /></div>
                            <button type="submit" className="btn btn-primary">{t.manager.registerWorker}</button>
                        </form>
                    </div>
                )}
            </div>

            <InvoiceTemplate ref={invoiceRef} invoiceData={invoiceData} />
            <WorkerReportTemplate ref={workerReportRef} reportData={workerReportData} />
        </div>
    );
};

export default ManagerDashboard;

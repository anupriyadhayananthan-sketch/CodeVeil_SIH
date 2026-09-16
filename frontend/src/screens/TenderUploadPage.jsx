import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { parseApiError } from '../utils/apiError';
import { DeadlineCountdown } from '../components/DeadlineCountdown';
import { Upload, FileText, Users, CheckCircle2, AlertCircle, Cpu, Loader2, Code, Eye, ArrowRight, BookOpen, Layers, Clock, Lock } from 'lucide-react';

export const TenderUploadPage = ({ setCurrentTab }) => {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState('tender');

  const getDefaultDeadline = () => {
    const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  const [tenderNumber, setTenderNumber] = useState('GEM/2026/B/SAFETY-004');
  const [title, setTitle] = useState('Supply of High-Pressure Gas Testing Safety Instruments');
  const [authority, setAuthority] = useState('Chennai Petroleum Corporation Limited (CPCL)');
  const [category, setCategory] = useState('Safety Equipment');
  const [submissionDeadline, setSubmissionDeadline] = useState(getDefaultDeadline());
  const [file, setFile] = useState(null);

  const [tendersList, setTendersList] = useState([]);
  const [selectedTenderId, setSelectedTenderId] = useState('');
  const [bidderName, setBidderName] = useState('');
  const [bidderArchetype, setBidderArchetype] = useState('Clean');
  const [bidderPan, setBidderPan] = useState('AABCS1234C');
  const [bidderGstin, setBidderGstin] = useState('33AABCS1234C1Z5');
  const [bidderUdyam, setBidderUdyam] = useState('UDYAM-TN-03-0012345');
  const [bidAmount, setBidAmount] = useState('4850000');
  const [bidderFiles, setBidderFiles] = useState([]);

  const [uploading, setUploading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [stepLabel, setStepLabel] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  
  const [tenderResult, setTenderResult] = useState(null);
  const [bidderResult, setBidderResult] = useState(null);
  const [showRawOcrText, setShowRawOcrText] = useState(false);

  useEffect(() => {
    fetchTenders();
  }, []);

  const fetchTenders = async () => {
    try {
      const res = await fetch('/api/tenders', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setTendersList(data);
        if (data.length > 0) setSelectedTenderId(data[0].id);
      }
    } catch (err) {
      console.error("Fetch tenders error:", err);
    }
  };

  const handleTenderSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setMessage({ text: 'Please select a tender document PDF.', type: 'error' });
      return;
    }

    if (!submissionDeadline) {
      setMessage({ text: 'Please select a valid submission deadline.', type: 'error' });
      return;
    }

    setUploading(true);
    setMessage({ text: '', type: '' });
    setTenderResult(null);
    setProgressStep(1);
    setStepLabel('Uploading PDF document to secure storage...');

    try {
      const timer1 = setTimeout(() => {
        setProgressStep(2);
        setStepLabel('Performing OCR text & page structure extraction...');
      }, 600);

      const timer2 = setTimeout(() => {
        setProgressStep(3);
        setStepLabel('Sending extracted text to LLM / NLP engine for clause requirement parsing...');
      }, 1500);

      const timer3 = setTimeout(() => {
        setProgressStep(4);
        setStepLabel('Writing extracted requirements & citations to database...');
      }, 2500);

      const formData = new FormData();
      formData.append('tender_number', tenderNumber);
      formData.append('title', title);
      formData.append('issuing_authority', authority);
      formData.append('category', category);
      formData.append('submission_deadline', new Date(submissionDeadline).toISOString());
      formData.append('file', file);

      const res = await fetch('/api/tenders/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);

      const data = await res.json();
      if (!res.ok) {
        console.error("Tender upload API raw error response:", data);
        const readableError = parseApiError(data.detail);
        throw new Error(readableError);
      }

      setProgressStep(5);
      setStepLabel('Document AI Ingestion Complete!');
      setTenderResult(data);
      setMessage({ text: `Tender '${tenderNumber}' ingested successfully! ${data.requirements?.length || 0} clause requirements extracted by LLM.`, type: 'success' });
      fetchTenders();
    } catch (err) {
      console.error("Tender upload caught error:", err);
      setMessage({ text: err.message || 'Tender upload failed.', type: 'error' });
      setProgressStep(0);
    } finally {
      setUploading(false);
    }
  };

  const selectedTenderObj = tendersList.find(t => String(t.id) === String(selectedTenderId));
  const isSelectedTenderClosed = selectedTenderObj?.is_closed || (selectedTenderObj?.submission_deadline && new Date() > new Date(selectedTenderObj.submission_deadline));

  const handleBidderSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTenderId) {
      setMessage({ text: 'Please select a target tender.', type: 'error' });
      return;
    }

    if (isSelectedTenderClosed) {
      setMessage({ text: 'Tender submission deadline has passed. Uploads are blocked.', type: 'error' });
      return;
    }

    setUploading(true);
    setMessage({ text: '', type: '' });
    setBidderResult(null);
    setProgressStep(1);
    setStepLabel('Uploading bidder document package...');

    try {
      const timer1 = setTimeout(() => {
        setProgressStep(2);
        setStepLabel('Performing OCR text extraction on submitted document PDFs...');
      }, 600);

      const timer2 = setTimeout(() => {
        setProgressStep(3);
        setStepLabel('Extracting key fields (PAN, GSTIN, Udyam, Dates) via NLP...');
      }, 1400);

      const timer3 = setTimeout(() => {
        setProgressStep(4);
        setStepLabel('Executing deterministic rules engine compliance evaluation...');
      }, 2200);

      const formData = new FormData();
      formData.append('tender_id', selectedTenderId);
      formData.append('legal_name', bidderName);
      formData.append('archetype', bidderArchetype);
      if (bidderPan) formData.append('pan', bidderPan);
      if (bidderGstin) formData.append('gstin', bidderGstin);
      if (bidderUdyam) formData.append('udyam_number', bidderUdyam);
      formData.append('bid_amount_inr', bidAmount);

      for (let i = 0; i < bidderFiles.length; i++) {
        formData.append('files', bidderFiles[i]);
      }

      const res = await fetch('/api/bidders/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);

      const data = await res.json();
      if (!res.ok) {
        console.error("Bidder upload API raw error:", data);
        const readableError = parseApiError(data.detail);
        throw new Error(readableError);
      }

      setProgressStep(5);
      setStepLabel('Bidder Package Compliance Evaluation Complete!');
      setBidderResult(data);
      setMessage({ text: `Bidder '${bidderName}' package uploaded & verified successfully (Compliance Score: ${data.score}%, Risk: ${data.risk_level})!`, type: 'success' });
    } catch (err) {
      console.error("Bidder upload caught error:", err);
      setMessage({ text: err.message || 'Bidder upload failed.', type: 'error' });
      setProgressStep(0);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Document AI (OCR + NLP) Ingestion Pipeline</h1>
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-1">Ingest tender PDFs for clause extraction or upload bidder compliance document packages with real-time process visibility.</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('tender')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition ${
            activeTab === 'tender' ? 'bg-blue-700 text-white shadow-xs dark:bg-blue-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          1. Ingest Tender PDF (Clause Extraction)
        </button>

        <button
          onClick={() => setActiveTab('bidder')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition ${
            activeTab === 'bidder' ? 'bg-blue-700 text-white shadow-xs dark:bg-blue-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          2. Upload Bidder Document Package
        </button>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-100 border border-emerald-300 text-emerald-900 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200' : 'bg-rose-100 border border-rose-300 text-rose-900 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-200'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
          <span className="leading-relaxed font-bold">{message.text}</span>
        </div>
      )}

      {/* Progress Indicator */}
      {uploading && (
        <div className="p-6 bg-white border border-blue-200 dark:bg-slate-900 dark:border-slate-800 rounded-2xl space-y-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-black text-slate-900 dark:text-white">
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
              Document AI Pipeline Execution — Step {progressStep} of 4
            </span>
            <span className="text-blue-700 dark:text-blue-400 font-mono font-bold">{progressStep * 25}%</span>
          </div>

          <div className="w-full bg-slate-200 dark:bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-300 dark:border-slate-800">
            <div
              className="bg-blue-700 dark:bg-blue-500 h-full transition-all duration-500"
              style={{ width: `${progressStep * 25}%` }}
            />
          </div>

          <div className="grid grid-cols-4 gap-2 pt-1 text-[11px]">
            <div className={`p-2 rounded-lg border text-center font-bold transition ${progressStep >= 1 ? 'bg-blue-100 border-blue-300 text-blue-900 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200' : 'bg-slate-100 border-slate-200 text-slate-500 dark:bg-slate-950 dark:border-slate-800'}`}>
              Storage
            </div>
            <div className={`p-2 rounded-lg border text-center font-bold transition ${progressStep >= 2 ? 'bg-blue-100 border-blue-300 text-blue-900 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200' : 'bg-slate-100 border-slate-200 text-slate-500 dark:bg-slate-950 dark:border-slate-800'}`}>
              OCR Stage
            </div>
            <div className={`p-2 rounded-lg border text-center font-bold transition ${progressStep >= 3 ? 'bg-blue-100 border-blue-300 text-blue-900 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200' : 'bg-slate-100 border-slate-200 text-slate-500 dark:bg-slate-950 dark:border-slate-800'}`}>
              LLM / NLP
            </div>
            <div className={`p-2 rounded-lg border text-center font-bold transition ${progressStep >= 4 ? 'bg-blue-100 border-blue-300 text-blue-900 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200' : 'bg-slate-100 border-slate-200 text-slate-500 dark:bg-slate-950 dark:border-slate-800'}`}>
              Verified
            </div>
          </div>

          <p className="text-xs text-blue-900 dark:text-blue-200 font-mono font-bold bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>{stepLabel}</span>
          </p>
        </div>
      )}

      {/* Tab 1: Tender Upload Form */}
      {activeTab === 'tender' && (
        <div className="p-6 rounded-2xl border bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-sm space-y-6">
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Create New GeM Tender & Clause Ingestion
          </h2>

          <form onSubmit={handleTenderSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">GeM Tender Reference Number</label>
                <input
                  type="text"
                  required
                  value={tenderNumber}
                  onChange={(e) => setTenderNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 dark:bg-slate-950 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 dark:bg-slate-950 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 transition"
                >
                  <option value="Safety Equipment">Safety Equipment</option>
                  <option value="Maintenance Service">Maintenance Service</option>
                  <option value="MSME Purchase">MSME Purchase</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Tender Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 dark:bg-slate-950 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 transition"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Issuing Authority</label>
                <input
                  type="text"
                  required
                  value={authority}
                  onChange={(e) => setAuthority(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 dark:bg-slate-950 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Submission Deadline</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={submissionDeadline}
                  onChange={(e) => setSubmissionDeadline(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 dark:bg-slate-950 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-600 transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Tender Document (PDF)</label>
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-800 hover:border-blue-500 bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl text-center space-y-2 cursor-pointer transition">
                <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto" />
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="hidden"
                  id="tender-pdf-input"
                />
                <label htmlFor="tender-pdf-input" className="cursor-pointer block">
                  <span className="text-xs font-bold text-slate-900 dark:text-white hover:underline">
                    {file ? file.name : 'Click to select tender PDF file'}
                  </span>
                  <p className="text-[11px] text-slate-500 font-semibold mt-1">PDF documents up to 25MB supported</p>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={uploading}
              className="w-full py-3 bg-blue-700 hover:bg-blue-800 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition"
            >
              {uploading ? 'Processing Ingestion Pipeline...' : 'Start Document AI Ingestion'}
            </button>
          </form>
        </div>
      )}

      {/* Tab 2: Bidder Document Package Upload Form */}
      {activeTab === 'bidder' && (
        <div className="p-6 rounded-2xl border bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-sm space-y-6">
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Upload Bidder Document Package & Perform Compliance Check
          </h2>

          <form onSubmit={handleBidderSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Target GeM Tender Scenario</span>
              </label>
              <select
                value={selectedTenderId}
                onChange={(e) => setSelectedTenderId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 dark:bg-slate-950 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 transition"
              >
                {tendersList.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.tender_number} — {t.title} {t.is_closed ? '(CLOSED)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Bidder Legal Name</label>
                <input
                  type="text"
                  required
                  disabled={isSelectedTenderClosed}
                  value={bidderName}
                  onChange={(e) => setBidderName(e.target.value)}
                  placeholder="e.g. Apex Industrial Solutions Ltd"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 dark:bg-slate-950 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 dark:text-white transition disabled:opacity-50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Archetype Category</label>
                <select
                  disabled={isSelectedTenderClosed}
                  value={bidderArchetype}
                  onChange={(e) => setBidderArchetype(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 dark:bg-slate-950 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white transition disabled:opacity-50"
                >
                  <option value="Clean">Clean (All Valid Evidence)</option>
                  <option value="Missing-doc">Missing-doc (Missing Mandatory Document)</option>
                  <option value="Mismatch">Mismatch (Entity Name Mismatch)</option>
                  <option value="Expired-cert">Expired-cert (Lapsed / Expired License)</option>
                  <option value="Borderline">Borderline (Edge Boundary Value)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">PAN Number</label>
                <input
                  type="text"
                  disabled={isSelectedTenderClosed}
                  value={bidderPan}
                  onChange={(e) => setBidderPan(e.target.value)}
                  placeholder="AABCS1234C"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 dark:bg-slate-950 dark:border-slate-800 rounded-xl text-xs font-bold font-mono text-slate-900 dark:text-white transition disabled:opacity-50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">GSTIN Number</label>
                <input
                  type="text"
                  disabled={isSelectedTenderClosed}
                  value={bidderGstin}
                  onChange={(e) => setBidderGstin(e.target.value)}
                  placeholder="33AABCS1234C1Z5"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 dark:bg-slate-950 dark:border-slate-800 rounded-xl text-xs font-bold font-mono text-slate-900 dark:text-white transition disabled:opacity-50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Udyam Registration</label>
                <input
                  type="text"
                  disabled={isSelectedTenderClosed}
                  value={bidderUdyam}
                  onChange={(e) => setBidderUdyam(e.target.value)}
                  placeholder="UDYAM-TN-03-0012345"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 dark:bg-slate-950 dark:border-slate-800 rounded-xl text-xs font-bold font-mono text-slate-900 dark:text-white transition disabled:opacity-50"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Quoted Bid Amount (INR)</label>
              <input
                type="number"
                required
                disabled={isSelectedTenderClosed}
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder="4850000"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 dark:bg-slate-950 dark:border-slate-800 rounded-xl text-xs font-bold font-mono text-slate-900 dark:text-white transition disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Bidder Compliance Documents (Select PDF Files)</label>
              <div className={`border-2 border-dashed border-slate-300 dark:border-slate-800 hover:border-emerald-500 bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl text-center space-y-2 cursor-pointer transition ${isSelectedTenderClosed ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <Users className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
                <input
                  type="file"
                  multiple
                  disabled={isSelectedTenderClosed}
                  accept=".pdf"
                  onChange={(e) => setBidderFiles(Array.from(e.target.files))}
                  className="hidden"
                  id="bidder-files-input"
                />
                <label htmlFor="bidder-files-input" className={isSelectedTenderClosed ? "cursor-not-allowed block" : "cursor-pointer block"}>
                  <span className="text-xs font-bold text-slate-900 dark:text-white hover:underline">
                    {bidderFiles.length > 0 ? `${bidderFiles.length} document PDF files selected` : 'Click to select bidder document PDF files (PAN, GST, BIS, etc.)'}
                  </span>
                  <p className="text-[11px] text-slate-500 font-semibold mt-1">Select one or multiple PDF documents</p>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={uploading || isSelectedTenderClosed}
              className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Evaluating Bidder Compliance...' : isSelectedTenderClosed ? 'Submissions Blocked (Deadline Passed)' : 'Upload Bidder Package & Run Compliance Verification'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  Network, 
  Filter, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  UserCheck, 
  Building2, 
  CreditCard, 
  ChevronRight,
  HelpCircle,
  FileText,
  BadgeAlert,
  Info,
  Eye,
  CheckCircle2
} from 'lucide-react';

export const BidderRelationshipGraph = ({ selectedTenderId = 1 }) => {
  const { isDark } = useTheme();
  const { token } = useAuth();

  const [apiData, setApiData] = useState(null);
  const [loading, setLoading] = useState(true);

  // State for controls and filters
  const [filterDirector, setFilterDirector] = useState(true);
  const [filterAddress, setFilterAddress] = useState(true);
  const [filterBank, setFilterBank] = useState(true);
  const [riskFilter, setRiskFilter] = useState('ALL'); // 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
  
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    fetchGraphData();
  }, [selectedTenderId, token]);

  const fetchGraphData = async () => {
    setLoading(true);
    try {
      const url = selectedTenderId 
        ? `/api/collusion/network-graph?tender_id=${selectedTenderId}` 
        : '/api/collusion/network-graph';
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setApiData(data);
        if (data.bidders && data.bidders.length > 0) {
          setSelectedNodeId(data.bidders[0].id);
        }
      }
    } catch (err) {
      console.error("Error fetching database-driven network graph:", err);
    } finally {
      setLoading(false);
    }
  };

  // Database-Driven Heterogeneous Graph Data Model
  const graphData = useMemo(() => {
    if (apiData && apiData.bidders) {
      return {
        bidders: apiData.bidders || [],
        entities: apiData.entities || [],
        edges: apiData.edges || [],
        clusters: apiData.clusters || [],
        metadata: apiData.metadata || {}
      };
    }
    return {
      bidders: [],
      entities: [],
      edges: [],
      clusters: [],
      metadata: {}
    };
  }, [apiData]);

  // Frontend Layout Spacing Refinement Pass:
  // Enhances layout coordinates to prevent node & label overlaps while preserving backend community structure.
  const layoutNodes = useMemo(() => {
    if (!graphData.bidders.length && !graphData.entities.length) {
      return { bidders: [], entities: [], allNodesMap: new Map() };
    }

    const rawNodes = [
      ...graphData.bidders.map(b => ({ ...b, radius: 28, isBidder: true })),
      ...graphData.entities.map(e => ({ ...e, radius: 20, isBidder: false }))
    ];

    const nodes = rawNodes.map(n => ({
      ...n,
      x: n.x || 550,
      y: n.y || 280
    }));

    // Iterative collision resolution to ensure spacious visual distance
    const iterations = 45;
    const minDistance = 105;

    for (let iter = 0; iter < iterations; iter++) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i];
          const n2 = nodes[j];

          let dx = n2.x - n1.x;
          let dy = n2.y - n1.y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 1;

          const targetDist = n1.clusterId === n2.clusterId ? minDistance : minDistance * 1.35;
          if (dist < targetDist) {
            const overlap = (targetDist - dist) / dist * 0.45;
            const fx = dx * overlap;
            const fy = dy * overlap;

            n1.x -= fx;
            n1.y -= fy;
            n2.x += fx;
            n2.y += fy;
          }
        }
      }

      // Keep within viewBox padding bounds [75, 1025] x [75, 485]
      nodes.forEach(n => {
        n.x = Math.max(75, Math.min(1025, n.x));
        n.y = Math.max(75, Math.min(485, n.y));
      });
    }

    const bidders = [];
    const entities = [];
    const nodeMap = new Map();

    nodes.forEach(n => {
      nodeMap.set(n.id, n);
      if (n.isBidder) {
        bidders.push(n);
      } else {
        entities.push(n);
      }
    });

    return { bidders, entities, allNodesMap: nodeMap };
  }, [graphData]);

  // Selected node details
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return layoutNodes.bidders[0] || null;
    return layoutNodes.allNodesMap.get(selectedNodeId) || layoutNodes.bidders[0] || null;
  }, [selectedNodeId, layoutNodes]);

  // Filtered edges based on relationship check-boxes
  const visibleEdges = useMemo(() => {
    return graphData.edges.filter(edge => {
      if (edge.type === 'director' && !filterDirector) return false;
      if (edge.type === 'address' && !filterAddress) return false;
      if (edge.type === 'bank_account' && !filterBank) return false;
      return true;
    });
  }, [graphData.edges, filterDirector, filterAddress, filterBank]);

  // Set of connected node IDs for highlighting
  const activeConnectedIds = useMemo(() => {
    const activeId = hoveredNodeId || selectedNodeId;
    if (!activeId) return new Set();

    const set = new Set([activeId]);
    visibleEdges.forEach(edge => {
      if (edge.source === activeId) set.add(edge.target);
      if (edge.target === activeId) set.add(edge.source);
    });
    return set;
  }, [hoveredNodeId, selectedNodeId, visibleEdges]);

  // Helper for risk styling with light/dark contrast
  const getRiskStyles = (risk) => {
    switch (risk) {
      case 'HIGH':
        return {
          bg: 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800',
          badge: 'HIGH RISK',
          actionText: 'Requires Officer Review',
          nodeStroke: '#dc2626',
          nodeFill: isDark ? '#7f1d1d' : '#fee2e2',
          textFill: isDark ? '#fca5a5' : '#991b1b'
        };
      case 'MEDIUM':
        return {
          bg: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800',
          badge: 'MEDIUM RISK',
          actionText: 'Requires Further Review',
          nodeStroke: '#d97706',
          nodeFill: isDark ? '#78350f' : '#fef3c7',
          textFill: isDark ? '#fcd34d' : '#92400e'
        };
      case 'LOW':
        return {
          bg: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800',
          badge: 'LOW RISK',
          actionText: 'No Significant Indicator',
          nodeStroke: '#059669',
          nodeFill: isDark ? '#064e3b' : '#d1fae5',
          textFill: isDark ? '#6ee7b7' : '#065f46'
        };
      default:
        return {
          bg: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
          badge: 'NO INDICATOR',
          actionText: 'No Shared Relationship Detected',
          nodeStroke: '#64748b',
          nodeFill: isDark ? '#1e293b' : '#f1f5f9',
          textFill: isDark ? '#cbd5e1' : '#334155'
        };
    }
  };

  const totalBiddersCount = graphData.metadata?.total_bidders ?? graphData.bidders.length;
  const totalClustersCount = graphData.metadata?.total_clusters ?? graphData.clusters.length;
  const totalEdgesCount = graphData.edges.length;
  const highRiskClustersCount = graphData.metadata?.high_risk_clusters ?? graphData.clusters.filter(c => c.collusion_risk === 'HIGH').length;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="p-6 rounded-2xl border transition-colors duration-200 bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 bg-blue-100 border border-blue-200 dark:bg-blue-950/60 dark:border-blue-800 rounded-xl">
                <Network className="w-7 h-7 text-blue-700 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                  Bidder Relationship Intelligence
                  <span className="px-3 py-1 text-xs font-extrabold tracking-wider uppercase bg-emerald-100 border border-emerald-300 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 rounded-full">
                    DATABASE-DRIVEN NETWORKX
                  </span>
                </h1>
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                  NetworkX-based community graph construction from synthetic database records.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="px-3.5 py-2 bg-slate-100 border border-slate-300 dark:bg-slate-800 dark:border-slate-700 rounded-xl text-xs flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-slate-600 dark:text-slate-400 font-bold">Tender Filter:</span>
              <span className="font-mono font-black text-slate-900 dark:text-white text-sm">Tender #{selectedTenderId}</span>
            </div>

            <div className="px-3.5 py-2 bg-amber-100 border border-amber-300 text-amber-900 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-200 rounded-xl text-xs font-black flex items-center gap-2 shadow-xs">
              <BadgeAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>SYNTHETIC DATABASE DATA</span>
            </div>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          <div className="p-4 bg-slate-50 border border-slate-200 dark:bg-slate-950/60 dark:border-slate-800 rounded-xl space-y-1">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Bidders</span>
            <p className="text-3xl font-black text-slate-900 dark:text-white">{totalBiddersCount}</p>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Evaluated from DB</p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 dark:bg-slate-950/60 dark:border-slate-800 rounded-xl space-y-1">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Relationship Clusters</span>
            <p className="text-3xl font-black text-blue-700 dark:text-blue-400">{totalClustersCount}</p>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Detected communities</p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 dark:bg-slate-950/60 dark:border-slate-800 rounded-xl space-y-1">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Shared Relationships</span>
            <p className="text-3xl font-black text-amber-600 dark:text-amber-400">{totalEdgesCount}</p>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Intermediary entity links</p>
          </div>

          <div className="p-4 bg-rose-50 border border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/40 rounded-xl space-y-1">
            <span className="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider">High-Risk Clusters</span>
            <p className="text-3xl font-black text-rose-600 dark:text-rose-400">{highRiskClustersCount}</p>
            <p className="text-xs font-bold text-rose-700 dark:text-rose-300">Requires Officer Review</p>
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 bg-slate-100 border border-slate-200 dark:bg-slate-950/70 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <span>
            <strong className="text-slate-900 dark:text-white">Institutional Disclaimer:</strong> Risk indicators are analytical signals and do not constitute proof of collusion. <strong className="text-blue-800 dark:text-blue-300">"AI recommends. Officer decides."</strong>
          </span>
        </div>
      </div>

      {/* Main Graph Content Grid — Desktop 70% Width Graph / 30% Width Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LARGE GRAPH CONTAINER COLUMN (70% Width on desktop) */}
        <div className="lg:col-span-8 p-6 rounded-2xl border transition-colors duration-200 bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-sm space-y-4 flex flex-col justify-between">
          
          {/* Controls & Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
            {/* Relationship Checkboxes */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="font-extrabold text-slate-900 dark:text-slate-200 flex items-center gap-1.5 text-sm">
                <Filter className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Filter Layers:
              </span>

              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-300 dark:bg-slate-800 dark:border-slate-700 rounded-xl cursor-pointer font-bold text-slate-800 dark:text-slate-200 hover:border-blue-500 transition-colors">
                <input
                  type="checkbox"
                  checked={filterDirector}
                  onChange={(e) => setFilterDirector(e.target.checked)}
                  className="rounded border-slate-400 text-blue-600 focus:ring-0"
                />
                <span className="w-3 h-3 rotate-45 bg-blue-600 inline-block"></span>
                <span>Shared Director</span>
              </label>

              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-300 dark:bg-slate-800 dark:border-slate-700 rounded-xl cursor-pointer font-bold text-slate-800 dark:text-slate-200 hover:border-amber-500 transition-colors">
                <input
                  type="checkbox"
                  checked={filterAddress}
                  onChange={(e) => setFilterAddress(e.target.checked)}
                  className="rounded border-slate-400 text-amber-600 focus:ring-0"
                />
                <span className="w-3 h-3 bg-amber-500 inline-block"></span>
                <span>Shared Address</span>
              </label>

              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-300 dark:bg-slate-800 dark:border-slate-700 rounded-xl cursor-pointer font-bold text-slate-800 dark:text-slate-200 hover:border-rose-500 transition-colors">
                <input
                  type="checkbox"
                  checked={filterBank}
                  onChange={(e) => setFilterBank(e.target.checked)}
                  className="rounded border-slate-400 text-rose-600 focus:ring-0"
                />
                <span className="w-3 h-3 bg-rose-600 clip-hexagon inline-block"></span>
                <span>Shared Bank Account</span>
              </label>
            </div>

            {/* Risk Level Radio Filters */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 border border-slate-300 dark:bg-slate-950 dark:border-slate-800 rounded-xl text-xs">
              <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 px-2 uppercase">Risk:</span>
              {['ALL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'].map((rf) => (
                <button
                  key={rf}
                  onClick={() => setRiskFilter(rf)}
                  className={`px-3 py-1 rounded-lg font-black text-xs transition-all ${
                    riskFilter === rf
                      ? 'bg-blue-700 text-white shadow-xs dark:bg-blue-600'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {rf}
                </button>
              ))}
            </div>
          </div>

          {/* LARGE GRAPH VIEWPORT (Height: 650px) */}
          <div className="relative w-full h-[650px] bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-300 dark:border-slate-800 overflow-hidden shadow-inner">
            
            {/* Zoom Controls Overlay */}
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-1.5 bg-white border border-slate-300 dark:bg-slate-900 dark:border-slate-700 p-1.5 rounded-xl shadow-md">
              <button
                onClick={() => setZoomLevel(prev => Math.min(prev + 0.15, 1.8))}
                className="p-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 rounded-lg transition"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoomLevel(prev => Math.max(prev - 0.15, 0.6))}
                className="p-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 rounded-lg transition"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setZoomLevel(1); setPanOffset({ x: 0, y: 0 }); }}
                className="p-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 rounded-lg transition"
                title="Reset View"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* SVG Visual Graph Rendering */}
            <svg
              className="w-full h-full cursor-grab active:cursor-grabbing"
              viewBox="0 0 1100 560"
              preserveAspectRatio="xMidYMid meet"
            >
              <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoomLevel})`}>
                
                {/* Dynamic Community Clusters Boundaries */}
                {graphData.clusters?.map((c) => {
                  if (riskFilter !== 'ALL' && c.collusion_risk !== riskFilter) return null;
                  
                  const allCompNodeIds = [
                    ...(c.bidder_ids || []),
                    ...layoutNodes.entities
                      .filter(ent => ent.connectedBidderIds?.some(bId => (c.bidder_ids || []).includes(bId)))
                      .map(ent => ent.id)
                  ];
                  const clusterNodes = allCompNodeIds.map(id => layoutNodes.allNodesMap.get(id)).filter(Boolean);
                  if (clusterNodes.length === 0) return null;

                  const minX = Math.min(...clusterNodes.map(n => n.x)) - 65;
                  const maxX = Math.max(...clusterNodes.map(n => n.x)) + 65;
                  const minY = Math.min(...clusterNodes.map(n => n.y)) - 55;
                  const maxY = Math.max(...clusterNodes.map(n => n.y)) + 55;
                  const width = Math.max(maxX - minX, 190);
                  const height = Math.max(maxY - minY, 130);

                  const strokeColor = c.collusion_risk === 'HIGH' ? '#ef4444' : (c.collusion_risk === 'MEDIUM' ? '#d97706' : '#059669');
                  const fillColor = c.collusion_risk === 'HIGH'
                    ? (isDark ? 'rgba(244, 63, 94, 0.12)' : 'rgba(254, 226, 226, 0.6)')
                    : (c.collusion_risk === 'MEDIUM'
                      ? (isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(254, 243, 199, 0.6)')
                      : (isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(209, 250, 229, 0.6)'));

                  return (
                    <g key={c.cluster_id}>
                      <rect
                        x={minX}
                        y={minY}
                        width={width}
                        height={height}
                        rx="18"
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth="2"
                        strokeDasharray="6,4"
                      />
                      <rect x={minX + 14} y={minY - 16} width={Math.min(width - 28, 240)} height="26" rx="8" fill={strokeColor} />
                      <text x={minX + 22} y={minY + 1} fill="#ffffff" fontSize="11.5" fontWeight="900">
                        {c.cluster_label || `Cluster ${c.cluster_id}`} — {c.collusion_risk} RISK
                      </text>
                    </g>
                  );
                })}

                {/* Edges */}
                {visibleEdges.map(edge => {
                  const srcNode = layoutNodes.allNodesMap.get(edge.source);
                  const tgtNode = layoutNodes.allNodesMap.get(edge.target);
                  if (!srcNode || !tgtNode) return null;

                  const isHighlighted = activeConnectedIds.has(edge.source) && activeConnectedIds.has(edge.target);
                  const isDimmed = activeConnectedIds.size > 1 && !isHighlighted;

                  let strokeColor = isDark ? '#475569' : '#94a3b8';
                  if (edge.type === 'director') strokeColor = '#2563eb';
                  if (edge.type === 'address') strokeColor = '#d97706';
                  if (edge.type === 'bank_account') strokeColor = '#dc2626';

                  return (
                    <g key={edge.id}>
                      <line
                        x1={srcNode.x}
                        y1={srcNode.y}
                        x2={tgtNode.x}
                        y2={tgtNode.y}
                        stroke={isHighlighted ? strokeColor : (isDark ? '#334155' : '#cbd5e1')}
                        strokeWidth={isHighlighted ? 3.5 : 2}
                        strokeOpacity={isDimmed ? 0.15 : (isHighlighted ? 1 : 0.75)}
                        strokeDasharray={edge.type === 'bank_account' ? '5,4' : undefined}
                      />
                    </g>
                  );
                })}

                {/* Intermediary Entity Nodes (Directors, Addresses, Bank Accounts) */}
                {layoutNodes.entities.map(ent => {
                  if (ent.type === 'director' && !filterDirector) return null;
                  if (ent.type === 'address' && !filterAddress) return null;
                  if (ent.type === 'bank_account' && !filterBank) return null;

                  const isSelected = selectedNodeId === ent.id;
                  const isConnected = activeConnectedIds.has(ent.id);
                  const isDimmed = activeConnectedIds.size > 1 && !isConnected;

                  return (
                    <g
                      key={ent.id}
                      transform={`translate(${ent.x}, ${ent.y})`}
                      className="cursor-pointer transition-transform duration-200 hover:scale-110"
                      onClick={() => setSelectedNodeId(ent.id)}
                      onMouseEnter={() => setHoveredNodeId(ent.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                      opacity={isDimmed ? 0.2 : 1}
                    >
                      {/* Shapes based on entity type */}
                      {ent.type === 'director' && (
                        <polygon
                          points="0,-20 20,0 0,20 -20,0"
                          fill={isSelected ? '#2563eb' : (isDark ? '#1e3a8a' : '#dbeafe')}
                          stroke="#2563eb"
                          strokeWidth={isSelected ? 3.5 : 2.5}
                        />
                      )}

                      {ent.type === 'address' && (
                        <rect
                          x="-16"
                          y="-16"
                          width="32"
                          height="32"
                          rx="6"
                          fill={isSelected ? '#d97706' : (isDark ? '#78350f' : '#fef3c7')}
                          stroke="#d97706"
                          strokeWidth={isSelected ? 3.5 : 2.5}
                        />
                      )}

                      {ent.type === 'bank_account' && (
                        <polygon
                          points="0,-18 16,-9 16,9 0,18 -16,9 -16,-9"
                          fill={isSelected ? '#dc2626' : (isDark ? '#7f1d1d' : '#fee2e2')}
                          stroke="#dc2626"
                          strokeWidth={isSelected ? 3.5 : 2.5}
                        />
                      )}

                      {/* Label Background Pill for high readability */}
                      <rect
                        x="-65"
                        y="24"
                        width="130"
                        height="26"
                        rx="6"
                        fill={isDark ? "rgba(15, 23, 42, 0.92)" : "rgba(255, 255, 255, 0.94)"}
                        stroke={isDark ? "rgba(51, 65, 85, 0.8)" : "rgba(203, 213, 225, 0.9)"}
                      />
                      <text
                        y="36"
                        textAnchor="middle"
                        fill={isDark ? '#e2e8f0' : '#0f172a'}
                        fontSize="10.5"
                        fontWeight="bold"
                        className="pointer-events-none select-none"
                      >
                        {ent.label.length > 18 ? ent.label.substring(0, 16) + '...' : ent.label}
                      </text>
                      <text
                        y="47"
                        textAnchor="middle"
                        fill={isDark ? '#94a3b8' : '#64748b'}
                        fontSize="9"
                        fontWeight="700"
                        className="pointer-events-none select-none"
                      >
                        {ent.subtitle}
                      </text>
                    </g>
                  );
                })}

                {/* Bidder Nodes */}
                {layoutNodes.bidders.map(bidder => {
                  if (riskFilter !== 'ALL' && bidder.risk !== riskFilter) return null;

                  const isSelected = selectedNodeId === bidder.id;
                  const isConnected = activeConnectedIds.has(bidder.id);
                  const isDimmed = activeConnectedIds.size > 1 && !isConnected;
                  const styles = getRiskStyles(bidder.risk);

                  return (
                    <g
                      key={bidder.id}
                      transform={`translate(${bidder.x}, ${bidder.y})`}
                      className="cursor-pointer transition-all duration-200"
                      onClick={() => setSelectedNodeId(bidder.id)}
                      onMouseEnter={() => setHoveredNodeId(bidder.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                      opacity={isDimmed ? 0.2 : 1}
                    >
                      {bidder.risk === 'HIGH' && (
                        <circle
                          r="34"
                          fill="none"
                          stroke="#dc2626"
                          strokeWidth="2"
                          strokeOpacity="0.4"
                          className="animate-ping"
                        />
                      )}

                      <circle
                        r="28"
                        fill={isSelected ? styles.nodeStroke : styles.nodeFill}
                        stroke={styles.nodeStroke}
                        strokeWidth={isSelected ? 4 : 3}
                      />

                      <text
                        y="5"
                        textAnchor="middle"
                        fill={isSelected ? '#ffffff' : styles.textFill}
                        fontSize="12.5"
                        fontWeight="900"
                        className="pointer-events-none select-none"
                      >
                        {(bidder.shortName || bidder.label).substring(0, 3).toUpperCase()}
                      </text>

                      {/* Label Background Pill for high readability */}
                      <rect
                        x="-75"
                        y="32"
                        width="150"
                        height="34"
                        rx="8"
                        fill={isDark ? "rgba(15, 23, 42, 0.94)" : "rgba(255, 255, 255, 0.95)"}
                        stroke={isDark ? "rgba(51, 65, 85, 0.85)" : "rgba(203, 213, 225, 0.95)"}
                      />

                      <text
                        y="46"
                        textAnchor="middle"
                        fill={isDark ? '#ffffff' : '#0f172a'}
                        fontSize="12"
                        fontWeight="900"
                        className="pointer-events-none select-none"
                      >
                        {(bidder.shortName || bidder.label).length > 20 ? (bidder.shortName || bidder.label).substring(0, 18) + '...' : (bidder.shortName || bidder.label)}
                      </text>

                      <text
                        y="60"
                        textAnchor="middle"
                        fill={styles.nodeStroke}
                        fontSize="10"
                        fontWeight="900"
                        className="pointer-events-none select-none"
                      >
                        {styles.badge}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>

            {/* Hover Tooltip Overlay */}
            {hoveredNodeId && (
              <div className="absolute bottom-4 left-4 z-20 p-3.5 bg-white border border-slate-300 dark:bg-slate-900 dark:border-slate-700 rounded-xl shadow-2xl text-xs space-y-1 max-w-xs animate-fadeIn">
                {(() => {
                  const node = layoutNodes.allNodesMap.get(hoveredNodeId);
                  if (!node) return null;
                  if (node.type === 'bidder') {
                    const styles = getRiskStyles(node.risk);
                    return (
                      <>
                        <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-1.5">
                          <span className="font-black text-slate-900 dark:text-white text-sm">{node.label}</span>
                          <span className={`px-2 py-0.5 text-[10px] font-black rounded border ${styles.bg}`}>
                            {styles.badge}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs pt-1">
                          <span className="text-slate-500 dark:text-slate-400">Bid Status:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{node.status}</span>
                          <span className="text-slate-500 dark:text-slate-400">Bid Amount:</span>
                          <span className="font-mono font-black text-blue-700 dark:text-blue-400">{node.bidAmount}</span>
                          <span className="text-slate-500 dark:text-slate-400">Compliance:</span>
                          <span className="font-bold text-emerald-700 dark:text-emerald-400">{node.compliance} ({node.score}%)</span>
                          <span className="text-slate-500 dark:text-slate-400">Connections:</span>
                          <span className="font-bold text-slate-900 dark:text-white">{node.connectionsCount} shared entities</span>
                        </div>
                      </>
                    );
                  } else {
                    return (
                      <>
                        <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-1.5">
                          <span className="font-black text-blue-800 dark:text-blue-300 text-sm">{node.label}</span>
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200 border border-blue-300 dark:border-blue-800 rounded">
                            {node.subtitle}
                          </span>
                        </div>
                        <div className="text-xs text-slate-700 dark:text-slate-300 pt-1 space-y-1">
                          <p><strong className="text-slate-500 dark:text-slate-400">Connected Bidders:</strong> {node.connectedBidders?.length}</p>
                          <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 leading-tight">{node.connectedBidders?.join(', ')}</p>
                        </div>
                      </>
                    );
                  }
                })()}
              </div>
            )}
          </div>

          {/* Expanded Graph Legend Bar */}
          <div className="p-4 bg-slate-50 border border-slate-200 dark:bg-slate-950/80 dark:border-slate-800 rounded-xl space-y-2">
            <span className="font-black text-slate-900 dark:text-white text-xs uppercase tracking-wider block">
              Graph Shapes & Status Legend:
            </span>
            <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-bold text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-rose-600 border border-rose-300 inline-block"></span>
                <span>● High Risk Bidder</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-amber-500 border border-amber-300 inline-block"></span>
                <span>● Medium Risk Bidder</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 border border-emerald-300 inline-block"></span>
                <span>● Low Risk Bidder</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-slate-500 border border-slate-300 inline-block"></span>
                <span>● No Risk Indicator</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rotate-45 bg-blue-600 inline-block"></span>
                <span>◆ Shared Director</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 bg-amber-500 inline-block"></span>
                <span>■ Shared Address</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 bg-rose-600 clip-hexagon inline-block"></span>
                <span>⬡ Shared Bank Account</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT-SIDE SELECTED BIDDER & "WHY FLAGGED?" DETAILS PANEL (30% Width on desktop) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Selected Entity Details Card */}
          <div className="p-6 rounded-2xl border transition-colors duration-200 bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Selected Entity Detail
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono font-bold">Node ID: {selectedNode?.id || '-'}</span>
            </div>

            {selectedNode && selectedNode.type === 'bidder' ? (
              <>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">{selectedNode.label}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="px-3 py-1 text-xs font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Compliance: {selectedNode.compliance} ({selectedNode.score}%)
                    </span>
                    <span className={`px-3 py-1 text-xs font-black rounded-lg border ${getRiskStyles(selectedNode.risk).bg}`}>
                      {getRiskStyles(selectedNode.risk).badge}
                    </span>
                  </div>
                </div>

                {/* Relationship Indicators List */}
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Relationship Indicators
                  </h4>
                  {selectedNode.relationships && selectedNode.relationships.length > 0 ? (
                    <div className="space-y-2">
                      {selectedNode.relationships.map((rel, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 border border-slate-200 dark:bg-slate-950/70 dark:border-slate-800 rounded-xl space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                              {rel.type === 'Shared Director' && <UserCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                              {rel.type === 'Shared Address' && <Building2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
                              {rel.type === 'Shared Bank Account' && <CreditCard className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />}
                              {rel.type}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">{rel.detail}</span>
                          </div>
                          <p className="text-slate-800 dark:text-slate-200 font-bold pl-5">{rel.target}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200 dark:bg-slate-950/60 dark:border-slate-800 rounded-xl text-xs text-slate-500 dark:text-slate-400 italic">
                      No shared relationships detected for this bidder entity.
                    </div>
                  )}
                </div>

                {/* Intelligence Summary Box */}
                <div className="p-4 bg-slate-50 border border-blue-200 dark:bg-slate-950 dark:border-slate-800 rounded-xl space-y-2 text-xs">
                  <span className="font-black text-blue-900 dark:text-blue-300 flex items-center gap-1.5 text-sm">
                    <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    Intelligence Summary
                  </span>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                    {selectedNode.risk === 'HIGH'
                      ? "Potential relationship concern detected. The bidder is connected to multiple participating bidders through shared directors, registered address, or bank account."
                      : selectedNode.risk === 'MEDIUM'
                      ? "Shared attribute indicator detected with another participating bidder entity."
                      : "Isolated bidder entity with normal independent relationship metrics."}
                  </p>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400 font-bold">Action Recommendation:</span>
                    <span className={`font-black px-2.5 py-1 border rounded-lg ${getRiskStyles(selectedNode.risk).bg}`}>
                      {getRiskStyles(selectedNode.risk).actionText}
                    </span>
                  </div>
                </div>
              </>
            ) : selectedNode ? (
              <div className="space-y-3 text-xs">
                <div>
                  <h3 className="text-lg font-black text-blue-900 dark:text-blue-300">{selectedNode.label}</h3>
                  <p className="text-slate-600 dark:text-slate-400 font-bold capitalize">{selectedNode.subtitle}</p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded-xl space-y-2">
                  <span className="font-extrabold text-slate-900 dark:text-white">Connected Bidding Entities:</span>
                  <ul className="space-y-1.5 pl-1">
                    {selectedNode.connectedBidders?.map((bName, i) => (
                      <li key={i} className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold">
                        <ChevronRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        {bName}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 italic">Select a node in the graph to view details.</div>
            )}
          </div>

          {/* Structured "Why is Flagged Cluster Risk Detected?" Panel */}
          <div className="p-6 rounded-2xl border transition-colors duration-200 bg-rose-50/70 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/50 space-y-4 shadow-sm">
            <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              Why is Flagged Cluster Risk Detected?
            </h2>

            <div className="space-y-2.5 text-xs">
              {graphData.clusters?.length > 0 ? (
                graphData.clusters.map((c, idx) => (
                  <div key={idx} className="p-3.5 bg-white border border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded-xl space-y-1 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-rose-700 dark:text-rose-400">{c.cluster_label || `Cluster ${c.cluster_id}`} ({c.collusion_risk} RISK)</span>
                      <span className="font-mono text-[10px] text-slate-500">Density: {c.density}</span>
                    </div>
                    <p className="text-slate-800 dark:text-slate-200 font-bold">Bidders: {c.bidders?.join(', ')}</p>
                    <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed">{c.reason}</p>
                  </div>
                ))
              ) : (
                <div className="p-3 bg-white dark:bg-slate-950 rounded-xl text-slate-500 italic">No clusters currently flagged.</div>
              )}
            </div>

            <div className="pt-2 border-t border-rose-200 dark:border-rose-900/40 text-xs space-y-1">
              <span className="font-extrabold text-slate-700 dark:text-slate-300">Conclusion:</span>
              <p className="text-rose-800 dark:text-rose-300 font-black">Data-Driven Network Relationship Indicator</p>
              <p className="text-amber-800 dark:text-amber-300 font-black">Action: Procurement Officer Review</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

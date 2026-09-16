import numpy as np
import pandas as pd
import networkx as nx
from typing import Dict, Any, List
try:
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False


def analyze_bid_price_rigging(tender_number: str, bidder_bids: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Coefficient-of-variation / spread-skewness bid-rigging screen on bid prices.
    Identifies cover bidding, price fixing, or sequential price offsets.
    """
    if len(bidder_bids) < 2:
        return {
            "tender_number": tender_number,
            "mean_price": 0.0,
            "std_price": 0.0,
            "cov_percent": 0.0,
            "spread_percent": 0.0,
            "skewness": 0.0,
            "rigging_risk_flag": False,
            "risk_reason": "Insufficient bids for statistical rigging screen (minimum 2 required).",
            "price_distribution": bidder_bids
        }

    prices = np.array([b["bid_amount_inr"] for b in bidder_bids], dtype=float)
    mean_p = float(np.mean(prices))
    std_p = float(np.std(prices))
    min_p = float(np.min(prices))
    max_p = float(np.max(prices))

    cov_percent = (std_p / mean_p * 100.0) if mean_p > 0 else 0.0
    spread_percent = ((max_p - min_p) / min_p * 100.0) if min_p > 0 else 0.0

    # Skewness calculation
    if len(prices) >= 3 and std_p > 0:
        skewness = float(np.mean(((prices - mean_p) / std_p) ** 3))
    else:
        skewness = 0.0

    # Screening rules: CoV < 1.5% is extremely suspicious for independent commercial bids
    rigging_flag = False
    reasons = []
    if cov_percent < 1.5:
        rigging_flag = True
        reasons.append(f"Abnormally low Coefficient of Variation (CoV = {cov_percent:.2f}% < 1.5%), indicating potential price coordination/fixing.")
    if spread_percent < 2.0:
        rigging_flag = True
        reasons.append(f"Narrow bid spread ({spread_percent:.2f}% < 2.0%) across all submitting entities.")

    risk_reason = " ".join(reasons) if rigging_flag else "Normal price variance pattern observed; no price-fixing screen trigger."

    return {
        "tender_number": tender_number,
        "mean_price": round(mean_p, 2),
        "std_price": round(std_p, 2),
        "cov_percent": round(cov_percent, 2),
        "spread_percent": round(spread_percent, 2),
        "skewness": round(skewness, 2),
        "rigging_risk_flag": rigging_flag,
        "risk_reason": risk_reason,
        "price_distribution": bidder_bids
    }

def generate_shell_company_network(db: Any = None, tender_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Database-driven NetworkX graph-based shell-company & relationship detector.
    Constructs an interpretable heterogeneous relationship graph from database records
    and executes NetworkX connected components community detection.
    """
    if db is None:
        from app.database import SessionLocal
        db_session = SessionLocal()
        close_session = True
    else:
        db_session = db
        close_session = False

    try:
        from app.models import Bidder, Document
        
        query = db_session.query(Bidder)
        if tender_id:
            query = query.filter(Bidder.tender_id == tender_id)
        db_bidders = query.all()

        if not db_bidders:
            db_bidders = db_session.query(Bidder).all()

        # Database synthetic relationship metadata registry mapped to existing synthetic records
        db_relationship_meta = {
            "Suryodaya Safety Systems Pvt Ltd": {
                "director": "Rajiv Menon",
                "address": "Chennai Industrial Estate",
                "bank_account": "XXXX-4821"
            },
            "PrimeShield Technologies Pvt Ltd": {
                "director": "Rajiv Menon",
                "address": "Chennai Industrial Estate",
                "bank_account": "XXXX-7316"
            },
            "SecureCore Systems Pvt Ltd": {
                "director": "Priya Sharma",
                "address": "Chennai Industrial Estate",
                "bank_account": "XXXX-4821"
            },
            "Apex Industrial Supplies": {
                "director": "Rajiv Menon",
                "address": "Bengaluru Peenya Industrial Area",
                "bank_account": "XXXX-4821"
            },
            "Bharat Safety Solutions": {
                "director": "Arun Kumar",
                "address": "Coimbatore SIDCO Industrial Estate",
                "bank_account": "XXXX-9054"
            },
            "ProShield Enterprises": {
                "director": "Meera Nair",
                "address": "Coimbatore SIDCO Industrial Estate",
                "bank_account": "XXXX-9054"
            },
            "National Safety Equipments": {
                "director": "Arun Kumar",
                "address": "Hyderabad Industrial Estate",
                "bank_account": "XXXX-1102"
            },
            "Vertex Industrial Solutions": {
                "director": "K. V. Raman",
                "address": "Kochi Special Economic Zone",
                "bank_account": "XXXX-8820"
            },
            "Kaveri PPE Traders": {
                "director": "R. Ramachandran",
                "address": "42 Industrial Estate, Ambattur, Chennai",
                "bank_account": "HDFC-XXXX-9182"
            },
            "Vendhar Fire Solutions": {
                "director": "R. Ramachandran",
                "address": "42 Industrial Estate, Ambattur, Chennai",
                "bank_account": "HDFC-XXXX-9183"
            }
        }

        G = nx.Graph()
        bidder_node_list = []
        entity_node_list = []
        edge_list = []

        # Add bidder nodes from DB
        for b in db_bidders:
            b_id = f"b_{b.id}"
            b_name = b.legal_name
            
            meta = db_relationship_meta.get(b_name, {})
            if not meta and b.pan:
                meta["director"] = f"Entity Director ({b.pan})"
            if not meta and b.gstin:
                state_code = b.gstin[:2]
                state_name = "Tamil Nadu Industrial Zone" if state_code == "33" else f"State Zone {state_code}"
                meta["address"] = state_name

            director = meta.get("director")
            address = meta.get("address")
            bank_acc = meta.get("bank_account")

            G.add_node(
                b_id,
                node_type="bidder",
                label=b_name,
                short_name=b_name.split()[0] + (" " + b_name.split()[1] if len(b_name.split()) > 1 else ""),
                bid_amount=f"₹{int(b.bid_amount_inr or 0):,}",
                status=b.status,
                compliance="PASS" if b.compliance_score >= 90 else ("FAIL" if b.compliance_score < 80 else "MANUAL_REVIEW"),
                score=round(b.compliance_score, 1),
                risk=b.risk_level.upper() if b.risk_level else "LOW",
                db_id=b.id
            )

            if director:
                d_id = f"d_{abs(hash(director)) % 10000}"
                if not G.has_node(d_id):
                    G.add_node(d_id, node_type="director", label=director, subtitle="Shared Director")
                G.add_edge(b_id, d_id, relationship="SHARED_DIRECTOR", label="Shared Director")

            if address:
                a_id = f"a_{abs(hash(address)) % 10000}"
                if not G.has_node(a_id):
                    G.add_node(a_id, node_type="address", label=address, subtitle="Shared Address")
                G.add_edge(b_id, a_id, relationship="SHARED_ADDRESS", label="Shared Address")

            if bank_acc:
                bk_id = f"bk_{abs(hash(bank_acc)) % 10000}"
                if not G.has_node(bk_id):
                    G.add_node(bk_id, node_type="bank_account", label=bank_acc, subtitle="Shared Bank Account")
                G.add_edge(b_id, bk_id, relationship="SHARED_BANK_ACCOUNT", label="Shared Bank")

        # NetworkX Community Detection (Connected Components)
        components = list(nx.connected_components(G))

        # Grid layout for communities across canvas (1100 x 560)
        num_clusters = len(components)
        cols = 3 if num_clusters >= 3 else max(num_clusters, 1)
        rows = (num_clusters + cols - 1) // cols

        slot_w = 980 / cols
        slot_h = 440 / max(rows, 1)

        pos = {}
        for c_idx, comp in enumerate(components):
            c_row = c_idx // cols
            c_col = c_idx % cols

            center_x = 100 + c_col * slot_w + slot_w / 2
            center_y = 80 + c_row * slot_h + slot_h / 2

            nodes_in_comp = list(comp)
            n_comp_nodes = len(nodes_in_comp)

            if n_comp_nodes == 1:
                pos[nodes_in_comp[0]] = (center_x, center_y)
            else:
                import math
                radius = min(slot_w, slot_h) * 0.34
                radius = max(radius, 75.0)
                for i, node in enumerate(nodes_in_comp):
                    angle = (2 * math.pi * i / n_comp_nodes) - (math.pi / 2)
                    nx_x = center_x + radius * math.cos(angle)
                    nx_y = center_y + radius * math.sin(angle)
                    pos[node] = (nx_x, nx_y)

        # Build formatted node objects
        for node_id, attrs in G.nodes(data=True):
            nx_pos = pos.get(node_id, (550, 280))
            x_coord = int(nx_pos[0])
            y_coord = int(nx_pos[1])

            if attrs.get("node_type") == "bidder":
                neighbors = list(G.neighbors(node_id))
                rels = []
                for nbr in neighbors:
                    nbr_data = G.nodes[nbr]
                    rel_type = "Shared Director" if nbr_data.get("node_type") == "director" else ("Shared Address" if nbr_data.get("node_type") == "address" else "Shared Bank Account")
                    rels.append({
                        "type": rel_type,
                        "target": nbr_data.get("label"),
                        "detail": f"Connected to {len(list(G.neighbors(nbr)))} bidders"
                    })

                bidder_node_list.append({
                    "id": node_id,
                    "label": attrs.get("label"),
                    "shortName": attrs.get("short_name"),
                    "type": "bidder",
                    "bidAmount": attrs.get("bid_amount"),
                    "status": attrs.get("status"),
                    "compliance": attrs.get("compliance"),
                    "score": attrs.get("score"),
                    "risk": attrs.get("risk"),
                    "clusterId": f"Cluster {node_id}",
                    "x": x_coord,
                    "y": y_coord,
                    "connectionsCount": len(neighbors),
                    "relationships": rels
                })
            else:
                connected_bidders = [G.nodes[nbr].get("label") for nbr in G.neighbors(node_id) if G.nodes[nbr].get("node_type") == "bidder"]
                connected_bidder_ids = [nbr for nbr in G.neighbors(node_id) if G.nodes[nbr].get("node_type") == "bidder"]
                entity_node_list.append({
                    "id": node_id,
                    "label": attrs.get("label"),
                    "subtitle": attrs.get("subtitle"),
                    "type": attrs.get("node_type"),
                    "x": x_coord,
                    "y": y_coord,
                    "connectedBidders": connected_bidders,
                    "connectedBidderIds": connected_bidder_ids
                })

        # Formatted edges
        edge_id_counter = 1
        for u, v, attrs in G.edges(data=True):
            u_type = G.nodes[u].get("node_type")
            v_type = G.nodes[v].get("node_type")
            entity_type = v_type if u_type == "bidder" else u_type
            
            edge_list.append({
                "id": f"e{edge_id_counter}",
                "source": u,
                "target": v,
                "type": entity_type,
                "label": attrs.get("label", "Shared Entity"),
                "relationship": attrs.get("relationship", "SHARED_ENTITY")
            })
            edge_id_counter += 1

        # NetworkX Community Detection (Connected Components)
        components = list(nx.connected_components(G))
        clusters = []
        cluster_letters = ["Cluster A", "Cluster B", "Cluster C", "Cluster D", "Cluster E"]
        
        for idx, comp in enumerate(components):
            subG = G.subgraph(comp)
            bidders_in_comp = [node for node in comp if G.nodes[node].get("node_type") == "bidder"]
            bidders_names = [G.nodes[node].get("label") for node in bidders_in_comp]
            
            if len(bidders_in_comp) >= 1:
                n_nodes = len(comp)
                n_edges = subG.number_of_edges()
                density = round((2.0 * n_edges) / (n_nodes * (n_nodes - 1)), 4) if n_nodes > 1 else 0.0
                
                rel_types = list(set([G.get_edge_data(u, v).get("relationship") for u, v in subG.edges() if G.get_edge_data(u, v)]))
                
                if len(bidders_in_comp) >= 3 and len(rel_types) >= 2:
                    c_risk = "HIGH"
                elif len(bidders_in_comp) >= 2:
                    c_risk = "HIGH" if len(rel_types) >= 2 else "MEDIUM"
                else:
                    c_risk = "LOW" if len(rel_types) > 0 else "NONE"

                reason_text = (
                    f"Community connects {len(bidders_in_comp)} bidding entities through shared "
                    f"{', '.join([r.replace('SHARED_', '').replace('_', ' ').lower() for r in rel_types]) if rel_types else 'attributes'}."
                )

                cluster_label = cluster_letters[idx] if idx < len(cluster_letters) else f"Cluster {idx+1}"
                
                for b_node in bidder_node_list:
                    if b_node["id"] in bidders_in_comp:
                        b_node["clusterId"] = cluster_label

                clusters.append({
                    "cluster_id": idx + 1,
                    "cluster_label": cluster_label,
                    "size": len(comp),
                    "bidders": bidders_names,
                    "bidder_ids": bidders_in_comp,
                    "collusion_risk": c_risk,
                    "reason": reason_text,
                    "relationship_types": rel_types,
                    "density": density
                })

        high_risk_count = len([c for c in clusters if c["collusion_risk"] == "HIGH"])

        return {
            "nodes": bidder_node_list + entity_node_list,
            "bidders": bidder_node_list,
            "entities": entity_node_list,
            "edges": edge_list,
            "clusters": clusters,
            "metadata": {
                "data_source": "SYNTHETIC_DATABASE",
                "graph_library": "NetworkX",
                "community_detection": "NetworkX Connected Components (nx.connected_components)",
                "total_bidders": len(bidder_node_list),
                "total_clusters": len(clusters),
                "high_risk_clusters": high_risk_count,
                "tender_id": tender_id
            }
        }
    finally:
        if close_session:
            db_session.close()

def train_and_evaluate_ml_risk_classifier() -> Dict[str, Any]:
    """
    Trains a scikit-learn Random Forest model on synthetic bidder metrics dataset.
    Returns model precision, recall, F1, accuracy, and feature importance.
    """
    # Create realistic synthetic training set (100 samples)
    np.random.seed(42)
    n_samples = 150
    missing_docs = np.random.randint(0, 3, n_samples)
    name_mismatch = np.random.choice([0, 1], size=n_samples, p=[0.8, 0.2])
    expired_certs = np.random.choice([0, 1], size=n_samples, p=[0.85, 0.15])
    cov_outlier = np.random.choice([0, 1], size=n_samples, p=[0.9, 0.1])
    shared_edge_count = np.random.randint(0, 4, n_samples)

    # Risk label rule: high risk if any critical flaw is present
    y = ((missing_docs > 0) | (name_mismatch == 1) | (expired_certs == 1) | (cov_outlier == 1) | (shared_edge_count > 1)).astype(int)
    X = np.column_stack((missing_docs, name_mismatch, expired_certs, cov_outlier, shared_edge_count))

    # Train / Test split
    split = int(0.7 * n_samples)
    X_train, X_test = X[:split], X[split:]
    y_train, y_test = y[:split], y[split:]

    clf = RandomForestClassifier(n_estimators=50, random_state=42)
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)

    acc = float(accuracy_score(y_test, y_pred))
    prec = float(precision_score(y_test, y_pred, zero_division=0))
    rec = float(recall_score(y_test, y_pred, zero_division=0))
    f1 = float(f1_score(y_test, y_pred, zero_division=0))

    feature_names = ["Missing Docs Count", "Legal Name Mismatch", "Expired Certificate", "CoV Price Rigging Flag", "Shared Network Edges"]
    importances = dict(zip(feature_names, [round(float(imp), 4) for imp in clf.feature_importances_]))

    return {
        "model_type": "Random Forest Classifier (scikit-learn)",
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1_score": round(f1, 4),
        "feature_importance": importances
    }

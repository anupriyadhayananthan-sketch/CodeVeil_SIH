from abc import ABC, abstractmethod
from typing import Dict, Any

class VerificationConnector(ABC):
    """
    Abstract Base Class for pluggable verification source connectors.
    Every connector must return a response with an explicit source_type:
    'official' | 'licensed_sandbox' | 'synthetic'
    """
    source_name: str
    source_type: str = "synthetic" # official, licensed_sandbox, synthetic

    @abstractmethod
    def verify(self, query_params: Dict[str, Any]) -> Dict[str, Any]:
        pass

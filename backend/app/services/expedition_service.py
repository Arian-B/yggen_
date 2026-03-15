from datetime import datetime
import traceback
import logging
from app.database.connection import db
from app.models.expedition_models import Expedition, ExpeditionCreate
from app.models.node_models import Node, NodeCreate
import uuid

logger = logging.getLogger(__name__)

class ExpeditionService:
    def __init__(self):
        self.db = db

    def create_expedition(self, user_id: str, root_topic: str) -> dict:
        """
        Creates a new expedition by fetching the Wikipedia graph structure.
        """
        from app.services.graph_generator import graph_generator

        # 0. Ensure user record exists
        self.ensure_user_exists(user_id)

        # 1. Build graph from Wikipedia
        try:
            graph_data = graph_generator.generate_initial_graph(root_topic)
        except Exception as e:
            raise ValueError(f"Failed to build Wikipedia graph: {str(e)}")

        # 1b. Use category already detected by graph_generator — no second fetch needed
        detected_domain = (
            graph_data['root'].get('category')
            or graph_data['root'].get('primary_domain')
            or 'General'
        )

        try:
            # 2. Create Expedition record
            expedition = Expedition(
                user_id=user_id,
                root_topic=graph_data['root']['topic'],
                domain=detected_domain
            )
            self.store_expedition(expedition)

            # 3. Create Root Node
            root_data = graph_data['root']
            root_node = Node(
                expedition_id=expedition.expedition_id,
                topic=root_data['topic'],
                level=root_data['level'],
                primary_domain=root_data['primary_domain'],
                difficulty_score=root_data['difficulty_score'],
                abstraction_score=root_data['abstraction_score'],
                wikipedia_url=root_data.get('wikipedia_url'),
                summary=root_data.get('summary'),
                link_type=None,
                parent_node_id=None
            )
            self.store_node(root_node)

            # 4. Embedded link nodes (Level +1)
            advanced = []
            for n_data in graph_data.get('advanced', []):
                node = Node(
                    expedition_id=expedition.expedition_id,
                    topic=n_data['topic'],
                    level=n_data['level'],
                    primary_domain=n_data['primary_domain'],
                    difficulty_score=n_data.get('difficulty_score', 50),
                    abstraction_score=n_data.get('abstraction_score', 50),
                    link_type=n_data.get('link_type', 'embedded_link'),
                    parent_node_id=root_node.node_id
                )
                self.store_node(node)
                self.create_edge(root_node.node_id, node.node_id, "embedded_link")
                advanced.append(node)

            # 5. See Also nodes (cross-links)
            cross_links = []
            for n_data in graph_data.get('cross_links', []):
                node = Node(
                    expedition_id=expedition.expedition_id,
                    topic=n_data['topic'],
                    level=n_data['level'],
                    primary_domain=n_data['primary_domain'],
                    difficulty_score=n_data.get('difficulty_score', 50),
                    abstraction_score=n_data.get('abstraction_score', 50),
                    link_type='see_also_link',
                    parent_node_id=root_node.node_id
                )
                self.store_node(node)
                self.create_edge(root_node.node_id, node.node_id, "see_also_link")
                cross_links.append(node)

            return {
                "expedition_id": expedition.expedition_id,
                "root_node": root_node.dict(),
                "linked_pages": [n.dict() for n in advanced],
                "see_also": [n.dict() for n in cross_links]
            }

        except Exception as e:
            logger.error(f"create_expedition DB phase FAILED:\n{traceback.format_exc()}")
            raise


    def _serialize_doc(self, doc: dict) -> dict:
        """
        Recursively convert datetime objects to ISO 8601 strings so ArangoDB
        can serialize them to JSON. This is needed because the python-arango
        driver does not auto-convert datetime objects.
        """
        from datetime import datetime
        return {
            k: v.isoformat() if isinstance(v, datetime) else v
            for k, v in doc.items()
        }

    def ensure_user_exists(self, user_id: str):
        """
        Auto-creates a user document if one doesn't exist yet.
        This is our lightweight 'auth' until a proper login system is added.
        Data is always tied to a user_id.
        """
        try:
            existing = self.db.db.collection('users').get(user_id)
            if not existing:
                from datetime import datetime
                self.db.db.collection('users').insert({
                    '_key': user_id,
                    'user_id': user_id,
                    'total_xp': 0,
                    'level': 0,
                    'created_at': datetime.utcnow().isoformat()
                })
        except Exception:
            pass  # Already exists or non-critical

    def store_expedition(self, expedition: Expedition):
        doc = self._serialize_doc(expedition.dict())
        doc['_key'] = expedition.expedition_id
        return self.db.db.collection('expeditions').insert(doc, overwrite=True)

    def store_node(self, node: Node):
        doc = self._serialize_doc(node.dict())
        doc['_key'] = node.node_id
        return self.db.db.collection('nodes').insert(doc, overwrite=True)

    def create_edge(self, from_node_uuid: str, to_node_uuid: str, type: str):
        edge = {
            "_from": f"nodes/{from_node_uuid}",
            "_to": f"nodes/{to_node_uuid}",
            "type": type
        }
        return self.db.db.collection('edges').insert(edge)

    def initialize_root_node(self):
        pass

expedition_service = ExpeditionService()

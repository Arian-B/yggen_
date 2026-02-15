from datetime import datetime
from app.database.connection import db
from app.models.expedition_models import Expedition, ExpeditionCreate
from app.models.node_models import Node, NodeCreate
import uuid

class ExpeditionService:
    def __init__(self):
        self.db = db

    async def create_expedition(self, user_id: str, root_topic: str) -> dict:
        """
        Creates a new expedition and initializes the AI-generated graph.
        """
        from app.services.graph_generator import graph_generator

        # 1. Generate Graph using AI
        # This might take a few seconds, so we do it first or async
        try:
            graph_data = await graph_generator.generate_initial_graph(root_topic)
        except Exception as e:
            # Fallback for dev/demo if AI fails or no key (schema mock)
             graph_data = {
                "root": {
                    "topic": root_topic,
                    "level": 0,
                    "primary_domain": "General",
                    "secondary_domains": [],
                    "difficulty_score": 10,
                    "abstraction_score": 10
                },
                "prerequisites": [],
                "advanced": [],
                "cross_links": []
            }

        # 2. Create Expedition Record
        expedition = Expedition(
            user_id=user_id,
            root_topic=graph_data['root']['topic']
        )
        exp_meta = self.store_expedition(expedition)
        
        # 3. Create Root Node
        root_data = graph_data['root']
        root_node = Node(
            expedition_id=expedition.expedition_id,
            topic=root_data['topic'],
            level=root_data['level'],
            primary_domain=root_data['primary_domain'],
            difficulty_score=root_data['difficulty_score'],
            abstraction_score=root_data['abstraction_score'],
            parent_node_id=None
        )
        root_meta = self.store_node(root_node)
        
        # 4. Process Prerequisites (Level -1)
        prereqs = []
        for p_data in graph_data.get('prerequisites', []):
            node = Node(
                expedition_id=expedition.expedition_id,
                topic=p_data['topic'],
                level=p_data['level'],
                primary_domain=p_data['primary_domain'],
                difficulty_score=p_data['difficulty_score'],
                abstraction_score=p_data['abstraction_score'],
                parent_node_id=root_node.node_id # Technically root is parent in terms of traversal, or vice-versa?
                # For prerequisites, the relationship is Prerequisite -> Root. 
                # In a tree, Root is usually top. But this is a graph. 
                # Let's link them loosely or use edge collection.
            )
            self.store_node(node)
            self.create_edge(node.node_id, root_node.node_id, "prerequisite_of")
            prereqs.append(node)

        # 5. Process Advanced (Level +1)
        advanced = []
        for a_data in graph_data.get('advanced', []):
            node = Node(
                expedition_id=expedition.expedition_id,
                topic=a_data['topic'],
                level=a_data['level'],
                primary_domain=a_data['primary_domain'],
                difficulty_score=a_data['difficulty_score'],
                abstraction_score=a_data['abstraction_score'],
                parent_node_id=root_node.node_id
            )
            self.store_node(node)
            self.create_edge(root_node.node_id, node.node_id, "advanced_of")
            advanced.append(node)
        
        return {
            "expedition_id": expedition.expedition_id,
            "root_node": root_node,
            "prerequisites": prereqs,
            "advanced": advanced
        }

    def store_expedition(self, expedition: Expedition):
        doc = expedition.dict()
        doc['_key'] = expedition.expedition_id
        return self.db.db.collection('expeditions').insert(doc, overwrite=True)

    def store_node(self, node: Node):
        doc = node.dict()
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

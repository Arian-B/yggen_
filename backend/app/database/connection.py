from arango import ArangoClient
from app.core.config import settings

class Database:
    def __init__(self):
        self.client = ArangoClient(hosts=settings.ARANGO_HOST)
        self.sys_db = self.client.db('_system', username=settings.ARANGO_USERNAME, password=settings.ARANGO_PASSWORD)
        self.db = None

    def connect(self):
        # Create DB if not exists
        if not self.sys_db.has_database(settings.ARANGO_DB):
            self.sys_db.create_database(settings.ARANGO_DB)
        
        self.db = self.client.db(settings.ARANGO_DB, username=settings.ARANGO_USERNAME, password=settings.ARANGO_PASSWORD)
        self._init_collections()

    def _init_collections(self):
        collections = ['users', 'expeditions', 'nodes']
        edge_collections = ['edges']

        for col in collections:
            if not self.db.has_collection(col):
                self.db.create_collection(col)

        for col in edge_collections:
            if not self.db.has_collection(col):
                self.db.create_collection(col, edge=True)

db = Database()

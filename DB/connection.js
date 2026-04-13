const {MongoClient} = require('mongodb');

const uri = 'mongodb://localhost:27017'
const client = new MongoClient(uri);

let db = null;

async function connectToDb(){
    try {
        if (!db) {
            await client.connect();
            db = client.db('mydatabase');
            console.log('Connected to MongoDB');
        }
        return db;
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        throw error;
    }

}

module.exports = { client, connectToDb };

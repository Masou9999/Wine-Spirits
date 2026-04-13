async function getWines(db, query = {}) {
   return await db.collection('wines').find(query).toArray();
}

module.exports = { getWines };

const jsonServer = require('json-server')
const server = jsonServer.create()
const router = jsonServer.router('db.json')
const middlewares = jsonServer.defaults()

// Usiamo i middleware di json-server (logging, etc.)
server.use(middlewares)

// Parsing del body in formato JSON
server.use(jsonServer.bodyParser)

// Rotta custom per aggiungere un commento
// Esempio: POST /books/1/comments con body { "comment": "Nuovo commento" }
server.post('/books/:id/comments', (req, res) => {
  const db = router.db  // LowDB instance
  const bookId = parseInt(req.params.id)
  const { comment } = req.body

  // 1. Recupera il libro nel db
  let book = db.get('books').find({ id: bookId }).value()

  if (!book) {
    return res.status(404).json({ error: 'Book not found' })
  }

  // 2. Aggiunge il nuovo commento
  book.comments.push(comment)

  // 3. Se superiamo i 20 commenti, eliminiamo il più vecchio
  if (book.comments.length > 20) {
    book.comments.shift()
  }

  // 4. Scriviamo i cambiamenti nel db
  db.get('books')
    .find({ id: bookId })
    .assign({ comments: book.comments })
    .write()

  // 5. Risposta con i commenti aggiornati
  return res.status(201).json(book)
})

// In coda, usiamo le rotte standard di json-server
server.use(router)

// Avvia il server sulla porta 3000 (o un’altra se preferisci)
server.listen(3000, () => {
  console.log('JSON Server with custom logic is running on http://localhost:3000')
})

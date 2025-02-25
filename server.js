require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();
app.use(cors());

app.use(express.json());

// Connect to Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * GET /books
 * Returns all books with their categories.
 */
app.get('/books', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('books')
      .select(`
        id, 
        title, 
        author, 
        image_url, 
        description, 
        pages,
        year,
        total_votes,
        average_rating,
        categories(name), 
        comments(id, comment_text),
        age_range
      `);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error in GET /books', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /books/:id
 * Returns a single book with its category and comments.
 */
app.get('/books/:id', async (req, res) => {
  const bookId = parseInt(req.params.id, 10);

  try {
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select(`
        id, 
        title, 
        author, 
        image_url, 
        description, 
        pages, 
        year, 
        total_votes,
        average_rating,
        categories(name),
        comments(id, comment_text),
        age_range
      `)
      .eq('id', bookId)
      .single();

    if (bookError) throw bookError;
    if (!book) return res.status(404).json({ error: 'Book not found' });

    res.json(book);
  } catch (err) {
    console.error('Error in GET /books/:id', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /books
 * Adds a new book (requires a valid category_id).
 */
app.post('/books', async (req, res) => {
  const { category_id, title, author, image_url, description,pages, year  } = req.body;

  try {
    const { data, error } = await supabase
      .from('books')
      .insert([{ category_id, title, author, image_url, description ,
        pages: pages || 0,   // Default to 0 if not provided
                    year: year || 2000
      }])
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('Error in POST /books', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /books/:id/comments
 * Adds a new comment to a book (max 20 per book).
 */
app.post('/books/:id/comments', async (req, res) => {
  const bookId = parseInt(req.params.id, 10);
  const { comment_text } = req.body;

  try {
    // 1. Ensure the book exists
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('id')
      .eq('id', bookId)
      .single();

    if (bookError || !book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    // 2. Insert the new comment
    const { error: insertError } = await supabase
      .from('comments')
      .insert([{ book_id: bookId, comment_text }]);

    if (insertError) throw insertError;

    // 3. Get all comments (order oldest first)
    const { data: comments, error: commentsError } = await supabase
      .from('comments')
      .select('*')
      .eq('book_id', bookId)
      .order('created_at', { ascending: true });

    if (commentsError) throw commentsError;

    // 4. If > 20 comments, delete the oldest
    if (comments.length > 20) {
      const oldestComment = comments[0];
      await supabase.from('comments').delete().eq('id', oldestComment.id);
    }

    // 5. Return the updated book with new comments
    const { data: updatedBook, error: updatedBookError } = await supabase
      .from('books')
      .select(`
        id, 
        title, 
        author, 
        image_url, 
        description, 
        created_at, 
        pages,
        year,
        total_votes,
        average_rating,
        categories(name),
        comments(id, comment_text),
        age_range
      `)
      .eq('id', bookId)
      .single();

    if (updatedBookError) throw updatedBookError;

    res.status(201).json(updatedBook);
  } catch (err) {
    console.error('Error in POST /books/:id/comments', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /categories
 * Returns all categories.
 */
app.get('/categories', async (req, res) => {
  try {
    const { data, error } = await supabase.from('categories').select('*');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error in GET /categories', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /categories
 * Adds a new category.
 */
app.post('/categories', async (req, res) => {
  const { name } = req.body;

  try {
    const { data, error } = await supabase
      .from('categories')
      .insert([{ name }])
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('Error in POST /categories', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/comments/:id', async (req, res) => {
  const commentId = parseInt(req.params.id, 10);
  const { comment_text } = req.body;

  try {
    // 1. Verifica se il commento esiste
    const { data: existingComment, error: fetchError } = await supabase
      .from('comments')
      .select('*')
      .eq('id', commentId)
      .single();

    if (fetchError || !existingComment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // 2. Aggiorna il testo
    const { data: updated, error: updateError } = await supabase
      .from('comments')
      .update({ comment_text })
      .eq('id', commentId)
      .select('*')
      .single();

    if (updateError) throw updateError;

    // 3. Restituisci il commento aggiornato
    return res.status(200).json(updated);
  } catch (err) {
    console.error('Error in PUT /comments/:id', err);
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/comments/:id', async (req, res) => {
  const commentId = parseInt(req.params.id, 10);

  try {
    // 1. Verifica se il commento esiste
    const { data: existingComment, error: fetchError } = await supabase
      .from('comments')
      .select('*')
      .eq('id', commentId)
      .single();

    if (fetchError || !existingComment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // 2. Elimina il commento
    const { error: deleteError } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (deleteError) throw deleteError;

    // 3. Rispondi con successo o restituisci la lista commenti aggiornata
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error in DELETE /comments/:id', err);
    return res.status(500).json({ error: err.message });
  }
});




app.post('/books/:id/rate', async (req, res) => {
  const bookId = parseInt(req.params.id);
  const { rating } = req.body;

  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Rating must be between 1 and 5" });
  }

  try {
    // 1. Ensure the book exists
    const { data: book, error: fetchError } = await supabase
      .from('books')
      .select('id, total_votes, average_rating')
      .eq('id', bookId)
      .single();

    if (fetchError || !book) {
      return res.status(404).json({ error: "Book not found" });
    }

    // 2. Calculate new rating values
    const newTotalVotes = book.total_votes + 1;
    const newAverageRating = (book.average_rating * book.total_votes + rating) / newTotalVotes;

    // 3. Update the book's rating
    const { error: updateError } = await supabase
      .from('books')
      .update({ total_votes: newTotalVotes, average_rating: newAverageRating })
      .eq('id', bookId);

    if (updateError) throw updateError;

    // 4. Fetch and return the updated book details
    const { data: updatedBook, error: updatedBookError } = await supabase
      .from('books')
      .select(`
        id, 
        title, 
        author, 
        image_url, 
        description, 
        pages,
        year,
        total_votes,
        average_rating,
        categories(name),
        comments(id, comment_text),
        age_range
      `)
      .eq('id', bookId)
      .single();

    if (updatedBookError) throw updatedBookError;

    res.status(200).json(updatedBook);
  } catch (err) {
    console.error("Error rating book:", err);
    res.status(500).json({ error: err.message });
  }
});




// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

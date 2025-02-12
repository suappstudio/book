require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
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
        categories(name), 
        comments(comment_text)
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
        categories(name),
        comments(comment_text)
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
        categories(name),
        comments(comment_text)
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

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

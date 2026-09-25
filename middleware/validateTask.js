function validateTask(req, res, next) {
  if (req.method === 'POST') {
    const { title } = req.body;
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ message: 'Title is required and must be a non-empty string' });
    }
  }

  if (req.method === 'PUT') {
    if (req.body.title !== undefined) {
      const { title } = req.body;
      if (typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ message: 'Title cannot be empty' });
      }
    }
  }

  next();
}

module.exports = validateTask;

const mongoose = require('mongoose')

module.exports = (...params) => (req, res, next) => {
  for (const p of params) {
    if (!mongoose.Types.ObjectId.isValid(req.params[p])) {
      return res.status(422).json({ message: `Invalid ${p}` })
    }
  }
  next()
}
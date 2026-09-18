exports.isEmail = (s) =>
  typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

exports.isStr = (s, min = 1, max = 500) =>
  typeof s === 'string' && s.trim().length >= min && s.trim().length <= max


exports.isNonEmptyStr = (s, max = 500) =>
  typeof s === 'string' && s.trim().length >= 1 && s.trim().length <= max

exports.isOptionalStr = (s, max = 500) =>
  s === undefined || (typeof s === 'string' && s.length <= max)

exports.isEnum = (v, arr) => arr.includes(v)

exports.isPositiveInt = (v) =>
  Number.isInteger(Number(v)) && Number(v) > 0

exports.isNonNegInt = (v) =>
  Number.isInteger(Number(v)) && Number(v) >= 0


exports.escapeRegex = (s) =>
  String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const { ApiError, asyncHandler, ok } = require('../utils/http');
const { validate, v } = require('../validators/validate');
const subjectModel = require('../models/subjectModel');
const log = require('../services/activityLogService').log;

/** GET /api/subjects */
const listSubjects = asyncHandler(async (req, res) => {
  const subjects = await subjectModel.getAll();
  ok(res, 200, subjects);
});

/** GET /api/subjects/search?q= */
const searchSubjects = asyncHandler(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) throw new ApiError(400, 'Query parameter q is required');
  ok(res, 200, await subjectModel.search(q));
});

/** POST /api/subjects — admin only. */
const createSubject = asyncHandler(async (req, res) => {
  const { code, name, description } = req.body;
  validate({
    code: [v.required('code'), v.maxLen(20)],
    name: [v.required('name'), v.maxLen(150)]
  }, req.body);
  if (await subjectModel.findByCode(code)) {
    throw new ApiError(409, `Subject code ${code} already exists`);
  }
  const subject = await subjectModel.create({ code: code.toUpperCase(), name, description });
  log(req, 'subject.create', 'subject', subject.id);
  ok(res, 201, subject, 'Subject created');
});

/** PUT /api/subjects/:id — admin only. */
const updateSubject = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const subject = await subjectModel.findById(id);
  if (!subject) throw new ApiError(404, 'Subject not found');
  const { code, name, description } = req.body;
  validate({
    code: [v.maxLen(20)],
    name: [v.maxLen(150)]
  }, req.body);
  if (code && (await subjectModel.findByCode(code)) && (await subjectModel.findByCode(code)).id !== id) {
    throw new ApiError(409, `Subject code ${code} already exists`);
  }
  await subjectModel.update(id, { code: code ? code.toUpperCase() : undefined, name, description });
  log(req, 'subject.update', 'subject', id);
  ok(res, 200, await subjectModel.findById(id), 'Subject updated');
});

/** DELETE /api/subjects/:id — admin only. */
const deleteSubject = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const subject = await subjectModel.findById(id);
  if (!subject) throw new ApiError(404, 'Subject not found');
  const affected = await subjectModel.remove(id);
  if (!affected) throw new ApiError(400, 'Subject is in use and cannot be removed');
  log(req, 'subject.delete', 'subject', id);
  ok(res, 200, null, 'Subject deleted');
});

module.exports = { listSubjects, searchSubjects, createSubject, updateSubject, deleteSubject };
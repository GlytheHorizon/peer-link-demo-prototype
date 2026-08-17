const { ApiError, asyncHandler, ok } = require('../utils/http');
const { validate, v } = require('../validators/validate');
const subjectRequestModel = require('../models/subjectRequestModel');
const subjectModel = require('../models/subjectModel');
const tutorModel = require('../models/tutorModel');
const log = require('../services/activityLogService').log;

/** POST /api/tutors/me/subject-requests — tutor requests a new subject to teach. */
const createRequest = asyncHandler(async (req, res) => {
  const { code, name, description, proficiency, strand } = req.body;
  validate({
    code: [v.required('code'), v.maxLen(20)],
    name: [v.required('name'), v.maxLen(150)],
    description: [v.maxLen(500)],
    proficiency: [v.intRange(1, 5, 'proficiency')],
    strand: [v.isIn(['STEM', 'GAS', 'ICT', 'ABM', 'HUMSS', 'JHS', null], 'strand')]
  }, req.body);

  const normalized = code.trim().toUpperCase();
  const existing = await subjectModel.findByCode(normalized);
  if (existing) {
    const profile = await tutorModel.findProfileByUserId(req.user.id);
    const keys = profile ? await tutorModel.getSubjectKeys(profile.id) : [];
    if (keys.includes(existing.id)) {
      throw new ApiError(409, `You already teach ${normalized} — no need to request it again`);
    }
  }
  if (await subjectRequestModel.findByTutorCode(req.user.id, normalized)) {
    throw new ApiError(409, `You already requested ${normalized} — it is awaiting review`);
  }

  const request = await subjectRequestModel.create(req.user.id, {
    code: normalized,
    name: name.trim(),
    description,
    proficiency,
    strand: strand || null
  });
  log(req, 'subject.request', 'subject_request', request.id);
  ok(res, 201, request, 'Subject addition request sent. An administrator will review it.');
});

/** GET /api/tutors/me/subject-requests — the tutor's own requests. */
const listMyRequests = asyncHandler(async (req, res) => {
  ok(res, 200, await subjectRequestModel.listByTutor(req.user.id));
});

/** GET /api/admin/subject-requests?status= — admin review queue. */
const listRequests = asyncHandler(async (req, res) => {
  const status = (req.query.status || '').trim();
  ok(res, 200, await subjectRequestModel.listByStatus(status || null));
});

/** POST /api/admin/subject-requests/:id/approve — creates the subject and assigns it to the tutor. */
const approveRequest = asyncHandler(async (req, res) => {
  const request = await subjectRequestModel.findById(Number(req.params.id));
  if (!request) throw new ApiError(404, 'Subject request not found');
  if (request.status !== 'pending') {
    throw new ApiError(400, `This request was already ${request.status}`);
  }

  const profile = await tutorModel.findProfileByUserId(request.tutor_id);
  if (!profile) throw new ApiError(400, 'The tutor no longer has a tutor profile');

  let subject = await subjectModel.findByCode(request.code);
  let created = false;
  if (!subject) {
    subject = await subjectModel.create({ code: request.code, name: request.name, description: request.description, strand: request.strand });
    created = true;
    log(req, 'subject.create', 'subject', subject.id);
  }
  await tutorModel.addSubjectToProfile(profile.id, subject.id, request.proficiency);
  await subjectRequestModel.setStatus(request.id, 'approved');
  log(req, 'subject.request_approved', 'subject_request', request.id);

  ok(res, 200, null, created
    ? `Subject ${subject.name} created and added to the tutor's list`
    : `${subject.name} already existed — added to the tutor's list`);
});

/** POST /api/admin/subject-requests/:id/reject — declines the request. */
const rejectRequest = asyncHandler(async (req, res) => {
  const request = await subjectRequestModel.findById(Number(req.params.id));
  if (!request) throw new ApiError(404, 'Subject request not found');
  if (request.status !== 'pending') {
    throw new ApiError(400, `This request was already ${request.status}`);
  }
  await subjectRequestModel.setStatus(request.id, 'rejected');
  log(req, 'subject.request_rejected', 'subject_request', request.id);
  ok(res, 200, null, 'Subject request rejected');
});

module.exports = { createRequest, listMyRequests, listRequests, approveRequest, rejectRequest };
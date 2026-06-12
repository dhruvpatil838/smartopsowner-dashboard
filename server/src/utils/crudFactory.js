import { asyncHandler } from "../middleware/error.js";

export function crudRoutes(Model, validator) {
  const list = asyncHandler(async (req, res) => {
    const items = await Model.find({ owner: req.user._id }).sort({ createdAt: -1 });
    res.json(items);
  });
  const create = asyncHandler(async (req, res) => {
    const data = validator.parse(req.body);
    const item = await Model.create({ ...data, owner: req.user._id });
    res.status(201).json(item);
  });
  const update = asyncHandler(async (req, res) => {
    const data = validator.partial().parse(req.body);
    const item = await Model.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      data,
      { new: true }
    );
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  });
  const remove = asyncHandler(async (req, res) => {
    const item = await Model.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  });
  return { list, create, update, remove };
}

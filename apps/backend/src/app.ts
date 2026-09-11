import morgan from "morgan";
import express, { ErrorRequestHandler } from "express";
import cors from "cors";
import { isUser, requireUser } from "~/controllers/user";
import { getProfile, patchProfile } from "~/controllers/profile";
import { getAllCourses, getCourseByID, getCourses, getFilteredCourses, getRequisites } from "~/controllers/courses";
import { getFCEs } from "~/controllers/fces";
import { getInstructors } from "~/controllers/instructors";
import { getGeneds } from "~/controllers/geneds";
import { getSchedules } from "~/controllers/schedules";

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(morgan("dev"));

app.route("/course/:courseID").get(getCourseByID);
app.route("/courses").get(getCourses);
app.route("/courses").post(isUser, getCourses);
app.route("/courses/all").get(getAllCourses);
app.route("/courses/requisites/:courseID").get(getRequisites);
app.route("/courses/search/").get(getFilteredCourses);
app.route("/courses/search/").post(isUser, getFilteredCourses);

app.route("/fces").post(isUser, getFCEs);

app.route("/instructors").get(getInstructors);
app.route("/schedules").get(getSchedules);

app.route("/geneds").get(getGeneds);
app.route("/geneds").post(isUser, getGeneds);

// The caller's own profile. POST is the read (the token travels in the body, like the other authed routes).
app.route("/user/profile").post(requireUser, getProfile);
app.route("/user/profile").patch(requireUser, patchProfile);

// the next parameter is needed!
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  console.error(err);
  res.status(500).json(err);
};

app.use(errorHandler);

app.listen(port, () => console.log(`Course Tool backend listening on port ${port}.`));

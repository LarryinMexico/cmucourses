import morgan from "morgan";
import express, { ErrorRequestHandler } from "express";
import cors from "cors";
import { isUser, requireUser } from "~/controllers/user";
import { createLimiters } from "~/rateLimit";
import { getProfile, patchProfile } from "~/controllers/profile";
import { getAllCourses, getCourseByID, getCourses, getFilteredCourses, getRequisites } from "~/controllers/courses";
import { getFCEs } from "~/controllers/fces";
import { getInstructors } from "~/controllers/instructors";
import { getGeneds } from "~/controllers/geneds";
import { getSchedules } from "~/controllers/schedules";
import { deleteRating, getOwnRating, getRatings, submitRating } from "~/controllers/ratings";
import { getFriendCourses, getSocialDirectory, updateFollow } from "~/controllers/social";
import {
  addPostComment,
  deletePost,
  deletePostComment,
  getFeed,
  listPostComments,
  reactToPost,
  sharePost,
} from "~/controllers/posts";
import { getThread, listConversations, sendMessage } from "~/controllers/messages";
import { deleteSavedSchedule, listSavedSchedules, saveSchedule } from "~/controllers/savedSchedules";

const app = express();
const port = process.env.PORT || 3000;
const { publicLimiter, authLimiter } = createLimiters();

// One proxy (the host's load balancer) sits in front, so req.ip is the client's address rather
// than the proxy's. With more hops this must change, or every client shares one rate-limit key.
app.set("trust proxy", 1);

app.use(cors());

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(morgan("dev"));
app.use(publicLimiter);

app.route("/course/:courseID").get(getCourseByID);
app.route("/courses").get(getCourses);
app.route("/courses").post(authLimiter, isUser, getCourses);
app.route("/courses/all").get(getAllCourses);
app.route("/courses/requisites/:courseID").get(getRequisites);
app.route("/courses/search/").get(getFilteredCourses);
app.route("/courses/search/").post(authLimiter, isUser, getFilteredCourses);

app.route("/fces").post(authLimiter, isUser, getFCEs);

app.route("/instructors").get(getInstructors);
app.route("/schedules").get(getSchedules);

app.route("/geneds").get(getGeneds);
app.route("/geneds").post(authLimiter, isUser, getGeneds);

// The caller's own profile. POST is the read (the token travels in the body, like the other authed routes).
app.route("/user/profile").post(authLimiter, requireUser, getProfile);
app.route("/user/profile").patch(authLimiter, requireUser, patchProfile);

// Other students' ratings for a course/instructor (?targetType=&targetID= in the query).
app.route("/ratings").post(authLimiter, isUser, getRatings);
// The caller's own rating: POST reads it (null if none), PATCH upserts it.
app.route("/user/rating").post(authLimiter, requireUser, getOwnRating);
app.route("/user/rating").patch(authLimiter, requireUser, submitRating);
app.route("/user/rating").delete(authLimiter, requireUser, deleteRating);

app.route("/social/directory").post(authLimiter, requireUser, getSocialDirectory);
app.route("/social/friend-courses").post(authLimiter, requireUser, getFriendCourses);
app.route("/user/social/follow").patch(authLimiter, requireUser, updateFollow);
app.route("/social/feed").post(authLimiter, requireUser, getFeed);
app.route("/user/posts").patch(authLimiter, requireUser, sharePost).delete(authLimiter, requireUser, deletePost);
app.route("/user/posts/reaction").patch(authLimiter, requireUser, reactToPost);
app.route("/social/posts/comments").post(authLimiter, requireUser, listPostComments);
app
  .route("/user/posts/comment")
  .patch(authLimiter, requireUser, addPostComment)
  .delete(authLimiter, requireUser, deletePostComment);
app.route("/user/messages/conversations").post(authLimiter, requireUser, listConversations);
app.route("/user/messages/thread").post(authLimiter, requireUser, getThread);
app.route("/user/messages").patch(authLimiter, requireUser, sendMessage);
app
  .route("/user/schedules")
  .post(authLimiter, requireUser, listSavedSchedules)
  .patch(authLimiter, requireUser, saveSchedule)
  .delete(authLimiter, requireUser, deleteSavedSchedule);

// the next parameter is needed!
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  console.error(err);
  res.status(500).json(err);
};

app.use(errorHandler);

app.listen(port, () => console.log(`Course Tool backend listening on port ${port}.`));

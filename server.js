// server.js
require("dotenv").config();
const express = require("express");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const flash = require("connect-flash");
const path = require("path");

const pool = require("./config/db");
const { attachUser } = require("./middleware/auth");

const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const secretaryRoutes = require("./routes/secretaryRoutes");
const headteacherRoutes = require("./routes/headteacherRoutes");
const publicRoutes = require("./routes/publicRoutes");

const app = express();

// ---- view engine ----
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ---- body parsing & static files ----
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---- sessions (persisted in MySQL, so logins survive server restarts) ----
const sessionStore = new MySQLStore({}, pool);

app.use(
  session({
    key: "etl_session",
    secret: process.env.SESSION_SECRET || "change_this_secret",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // requires HTTPS in production
    },
  })
);

app.use(flash());
app.use(attachUser);

// ---- routes ----
app.use("/", authRoutes);
app.use("/", publicRoutes); // /verify/:id and /sign/:token — no login required
app.use("/admin", adminRoutes);
app.use("/secretary", secretaryRoutes);
app.use("/headteacher", headteacherRoutes);

app.get("/", (req, res) => {
  if (req.session.user) return res.redirect(`/${req.session.user.role}`);
  res.redirect("/login");
});

// ---- 404 ----
app.use((req, res) => {
  res.status(404).render("error", { title: "Page not found", message: "The page you're looking for doesn't exist." });
});

// ---- error handler ----
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render("error", { title: "Something went wrong", message: "An unexpected error occurred. Please try again." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ETL Certificate Portal running at http://localhost:${PORT}`);
});

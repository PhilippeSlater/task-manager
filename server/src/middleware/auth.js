const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
    //Get token from header
    const token = req.headers.authorization?.split(" ")[1];

    //No token found
    if (!token)
        return res.status(401).json({ message: "No token" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch {
        res.status(401).json({ message: "Invalid token" });
    }
};

import React from 'react';
import { makeStyles } from '@material-ui/core';
const useStyles = makeStyles({
    svg: {
        width: 'auto',
        height: 30,
    },
    path: {
        fill: '#e25a1a', // Radiant Logic Orange
    },
});
const LogoFull = () => {
    const classes = useStyles();
    return (React.createElement("svg", { className: classes.svg, xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 380 40" },
        React.createElement("text", { x: "10", y: "30", fontFamily: "Open Sans, Arial, sans-serif", fontSize: "20", fontWeight: "bold", className: classes.path }, "Radiant Logic DevOps")));
};
export default LogoFull;
//# sourceMappingURL=LogoFull.js.map
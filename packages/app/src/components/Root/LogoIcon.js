import React from 'react';
import { makeStyles } from '@material-ui/core';
const useStyles = makeStyles({
    svg: {
        width: 'auto',
        height: 30,
    },
    path: {
        fill: '#7df3e1',
    },
});
const LogoIcon = () => {
    const classes = useStyles();
    return (React.createElement("svg", { className: classes.svg, xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 40 40" },
        React.createElement("circle", { cx: "20", cy: "20", r: "18", className: classes.path }),
        React.createElement("text", { x: "20", y: "28", fontFamily: "Arial, sans-serif", fontSize: "20", fontWeight: "bold", fill: "#000", textAnchor: "middle" }, "G")));
};
export default LogoIcon;
//# sourceMappingURL=LogoIcon.js.map
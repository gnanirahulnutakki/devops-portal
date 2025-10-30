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
const LogoFull = () => {
    const classes = useStyles();
    return (React.createElement("svg", { className: classes.svg, xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 200 40" },
        React.createElement("text", { x: "10", y: "30", fontFamily: "Arial, sans-serif", fontSize: "24", fontWeight: "bold", className: classes.path }, "GitOps Portal")));
};
export default LogoFull;
//# sourceMappingURL=LogoFull.js.map
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

  return (
    <svg
      className={classes.svg}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 40"
    >
      <circle cx="20" cy="20" r="18" className={classes.path} />
      <text
        x="20"
        y="28"
        fontFamily="Arial, sans-serif"
        fontSize="20"
        fontWeight="bold"
        fill="#000"
        textAnchor="middle"
      >
        G
      </text>
    </svg>
  );
};

export default LogoIcon;

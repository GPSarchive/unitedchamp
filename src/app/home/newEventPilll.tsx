import React from 'react';
import styled from 'styled-components';

const Card = () => {
  return (
    <StyledWrapper>
      <div className="card">
        <p><span>Box-1</span></p>
        <p><span>Box-2</span></p>
        <p><span>Box-3</span></p>
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  .card {
    width: 210px;
    height: 254px;
    border-radius: 8px;
    background: linear-gradient(145deg, #333, #000);
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 0.4em;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }

  .card p {
    flex: 1;
    overflow: hidden;
    cursor: pointer;
    border-radius: 8px;
    transition: flex 0.5s;
    background: linear-gradient(145deg, #212121, #000);
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .card p:hover {
    flex: 4;
  }

  .card p span {
    padding: 0.2em;
    text-align: center;
    transform: rotate(-0deg);
    transition: transform 0.5s;
    text-transform: uppercase;
    color: #00ffeb;
    font-weight: "bold";
    letter-spacing: 0.1em;
    position: relative;
    z-index: 1;
  }

  .card p:hover span {
    transform: rotate(0);
  }

  .card p::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.1);
    z-index: 0;
    transition: opacity 0.5s;
    pointer-events: none;
    opacity: 0;
  }

  .card p:hover::before {
    opacity: 1;
  }`;

export default Card;

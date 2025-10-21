import Waves from './waves';
import styles from './waves.module.css';

export default function Home() {
  return (
    <main className="bg-black min-h-screen flex items-center justify-center overflow-hidden relative">
      <Waves
        lineColor="#fff"
        backgroundColor="rgba(255, 255, 255, 0.2)"
        waveSpeedX={0.01}
        waveSpeedY={0.01}
        waveAmpX={40}
        waveAmpY={60}
        friction={0.9}
        tension={0.01}
        maxCursorMove={100000}
        xGap={12}
        yGap={36}
      />
      <div className={styles.content}>
        <h1>Waves Animation Demo</h1>
        <p>Interact with the waves by moving your mouse or touch!</p>
      </div>
    </main>
  );
}
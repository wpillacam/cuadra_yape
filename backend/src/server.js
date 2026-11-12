import 'dotenv/config';
import app from './app.js';

app.listen(Number(process.env.PORT || 4000), process.env.HOST || '127.0.0.1', () => {
  console.log('API de Cuadra Yape lista');
});

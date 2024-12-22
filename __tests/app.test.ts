import request from 'supertest';
import { app } from '../src/app';


describe('App Test', () => {
  test('GET /random-url should return 404', done => {
    request(app).get('/reset')
      .expect(404, done);
  });

});

import type { PhoneApp } from '../PhoneApp';
import { esc, naira, row, empty } from '../../ui/kit/html';
import { COURSES, Qualifications } from '../../life/Qualifications';

/** Courses that put a certificate on the CV. Each level is a fee and a test. */
export const coursesApp: PhoneApp = {
  id: 'courses',
  name: 'Courses',
  icon: '🎓',
  tint: ['#1e3a8a', '#60a5fa'],
  purpose: 'Study a trade, sit the test, and put the certificate on your CV',

  render(host, route) {
    const book = Qualifications.get();
    if (route.startsWith('c:')) {
      const course = book.course(route.slice(2));
      if (!course) return { title: 'Courses', body: empty('🎓', 'No such course', 'Pick one from the list.') };
      const have = book.level(course.id);
      const fee = have < 5 ? course.fees[have] : 0;
      return {
        title: course.name,
        body: `
          <div class="nl-card">
            <div class="nl-card-title">${esc(course.name)}</div>
            <div class="nl-card-line">You hold level ${have} of 5. Sit it in ${esc(host.world.cityName())}.</div>
            ${have < 5
              ? `<div class="nl-card-line">Level ${have + 1} is a class and a test. The fee is ${naira(fee)}.</div>
                 <button class="nl-btn nl-btn--primary nl-btn--block" data-act="sit" data-arg="${esc(course.id)}">Attend class and sit the test · ${naira(fee)}</button>`
              : '<div class="nl-note">You hold the top certificate. It is on your CV.</div>'}
          </div>
        `,
      };
    }
    return {
      title: 'Courses',
      body: `
        <div class="nl-list" id="courses-list">
          ${COURSES.map((course) => {
            const have = book.level(course.id);
            const fee = have < 5 ? course.fees[have] : 0;
            return row({
              icon: '🎓',
              title: esc(course.name),
              sub: have >= 5 ? 'Level 5 · on your CV' : `Level ${have} · next is ${naira(fee)}`,
              attrs: `data-go="c:${esc(course.id)}"`,
            });
          }).join('')}
        </div>
      `,
    };
  },

  act(host, action, el) {
    if (action !== 'sit') return;
    const result = Qualifications.get().sit(el.dataset.arg ?? '');
    host.say(result.message, result.ok ? 'good' : 'bad');
    if (result.ok) host.refresh();
  },
};

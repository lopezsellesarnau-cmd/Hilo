-- Demo stories for App Store screenshots (fiction): 14 approved stories for the senior named below,
-- placed into her books with the real rule (place_story), so the scroll shows three books with titles.
-- Run in the SQL Editor. To remove them, run the block at the end of this file.

do $$
declare
  senior record;
  story record;
  new_id uuid;
  chapter_titles text[] := array['The house on Calle Mayor', 'School and the river', 'Dancing in the square', 'Meeting Vicente', 'Our first home', 'When the children came', 'Sundays at the table'];
  book_titles text[] := array['Growing up in Alcoy', 'Love and a new home', 'The family table'];
  i int := 0;
  r record;
begin
  select id, family_id into senior from public.people where role = 'senior' and display_name = 'Margarita' limit 1;
  if senior.id is null then raise exception 'No senior called Margarita'; end if;

  for story in
    select * from (values
      (1, 'The smell of my mother''s bread', 'childhood', 1946, array[
        'Every morning the house smelled of bread before anyone was awake. My mother got up at five, lit the oven with olive wood and sang the same song while she kneaded.',
        'My job was to make the cross on top of each loaf with a knife. I was so proud of it. If the cross was crooked she said nothing, she just smiled and fixed it when I wasn''t looking.',
        'Even now, when I walk past a bakery, I stop for a second. It is her kitchen again, and I am six.',
        'I never learned her song properly. My daughter says I hum it when I cook, and I don''t even notice.']),
      (2, 'The courtyard with the fig tree', 'childhood', 1947, array[
        'Behind the house there was a courtyard with a fig tree older than my grandfather. In summer we ate lunch under it because it was the only shade in the whole street.',
        'My brother Pepe climbed to the top branches and threw figs down to me. Half of them broke on my head. My mother pretended to be angry, but she always ate the ones I caught.',
        'When they sold the house I asked for one thing only: a cutting of that tree. It still grows on my balcony.',
        'Every August it gives three or four figs. I eat the first one standing up, the way we did under the old tree.']),
      (3, 'Don Ernesto and the inkwell', 'school', 1949, array[
        'Our teacher, Don Ernesto, had a moustache like a broom and a voice you could hear from the river. He made us write with ink, and I always had blue fingers.',
        'One day I knocked the inkwell onto his register. I thought the world had ended. He looked at the stain for a long time and said it looked like a map of Mallorca.',
        'From that day he called me "the geographer". I never told him I had never seen the sea.',
        'I saw it for the first time at twenty-two, on my honeymoon. I thought of him and his map of Mallorca.']),
      (4, 'The winter the river froze', 'school', 1951, array[
        'That winter the river froze from one bank to the other. Nobody in Alcoy had seen it like that, not even the old men in the bar.',
        'My brother and I slid on our shoes all the way to the mill, and my mother shouted from the window that we would drown. We didn''t, but my shoes were never the same.',
        'They were a present from my godmother, who lived above the bakery. I hid them under the bed for a week so she wouldn''t see.',
        'When she found out, she laughed so much she had to sit down, and the next Sunday she bought me new ones.']),
      (5, 'The fiestas of Moors and Christians', 'youth', 1956, array[
        'In April the whole town turned into a story. The drums started at dawn and didn''t stop for three days. My father marched with the Christians in a cape he had sewn himself.',
        'I watched from my aunt''s balcony with my friends, throwing flowers at the boys we liked. We pretended not to care which ones caught them.',
        'I can still hear the gunpowder and smell the oranges. For me, that is what spring sounds like.',
        'My grandson marches now, in the same street, with the same drums. I watch him from a chair and I clap the loudest.']),
      (6, 'Saturday dances in the square', 'youth', 1958, array[
        'On Saturdays there was a band in the square and all the girls went in their best dress. Mine was green, made from a curtain, but nobody knew that.',
        'My mother let me go if I was home by ten. At five to ten I was always running up Calle Mayor with my shoes in my hand.',
        'Those were the happiest hours of the week. We danced pasodobles until our feet hurt and laughed the whole way home.',
        'Sometimes, when a pasodoble plays on the radio, I still get up and dance a few steps in the kitchen.',
        'My knees complain afterwards, but it is worth it.']),
      (7, 'The boy with the bicycle', 'love', 1959, array[
        'Vicente came to the square on a bicycle that was too big for him. He asked me to dance and stepped on my foot three times in one song.',
        'I told my friends he was a disaster. The next Saturday I looked for him the moment I arrived.',
        'He walked me home pushing that bicycle, and he did it every Saturday for two years before my father let him in the house.',
        'He kept that bicycle in the storeroom for fifty years. He said he owed it everything.',
        'When our grandson learned to ride, it was on that same bicycle, with new tyres and the old bell.']),
      (8, 'Our wedding in Santa María', 'love', 1962, array[
        'We married in Santa María on a cold morning in February. It rained, and my aunt said rain on a wedding brings luck. She was right.',
        'The lunch was at my parents'' house: rice, rabbit and a cake my mother made for two days. Vicente''s uncle played the guitar until the neighbours joined in.',
        'I kept a piece of my veil in a box. Sometimes I take it out and it still smells of that house.',
        'Carmen wore the same veil at her wedding. We had it cleaned, but I asked them not to wash out that smell.',
        'It is in the box again now, waiting.']),
      (9, 'Two rooms and a balcony', 'home', 1962, array[
        'Our first home was two rooms and a balcony above a shoe shop. In winter the walls were cold, and in summer you could hear the whole street.',
        'We had one table, four chairs and a radio Vicente had fixed himself. On Sunday nights we listened to the plays and I cried at every one.',
        'We had very little, but I have never been so sure that everything would be fine.',
        'The shoemaker downstairs gave us a pair of slippers each as a wedding present. Mine lasted ten years.',
        'His did not last one. He wore them to fix the radio on the balcony and lost one to the street.']),
      (10, 'Learning to cook for two', 'home', 1963, array[
        'I didn''t know how to cook. At home my mother never let anyone near her pots. The first paella I made for Vicente was more soup than rice.',
        'He ate two plates and said it was the best of his life. Then he went to his mother''s house for a second lunch. I found out years later.',
        'Little by little I learned. Today my paella is the one the whole family asks for.',
        'And every time I serve it, Vicente''s brother tells the story of that first soup. Fifty years, the same joke.',
        'And every time, Vicente laughed as if it were new.']),
      (11, 'The night Carmen was born', 'children', 1965, array[
        'Carmen was born on a night of storm, with the lights going on and off in the whole neighbourhood. The midwife came on foot, under an umbrella.',
        'When I held her she opened her eyes and looked at me very seriously, as if she wanted to check who I was. She still looks at me like that.',
        'Vicente spent the night walking up and down the corridor. In the morning he had smoked a whole packet without lighting a single cigarette.',
        'He named her after his mother. I wanted another name, but when I saw his face, I said yes.']),
      (12, 'Three children and one bathtub', 'children', 1969, array[
        'By the time Pepe was born we had three children and one bathtub. On Saturday nights it was a factory: one in, one out, one waiting with a towel.',
        'They sang so loudly that the neighbour below knocked on the ceiling with a broom. Then she came up with sweets for them anyway.',
        'People ask me how I did it. I don''t know. You just do it, and one day you look back and they are grown.',
        'Now they have their own children, and when they call me tired on a Saturday night, I only laugh.',
        'I tell them: wait until they are teenagers.']),
      (13, 'Sunday rice for twelve', 'traditions', 1985, array[
        'For years, every Sunday the whole family came to eat. Twelve at the table, and later sixteen when the grandchildren arrived.',
        'I started the rice at eleven. Vicente set the table and argued about football with my sons-in-law. The children hid under the table to steal the bread.',
        'Now we are fewer, but when they all come for Christmas, I still cook as if it were Sunday.',
        'There are always leftovers. That is the rule: if nothing is left, there wasn''t enough love in the pot.',
        'My mother said it, and her mother before her.']),
      (14, 'The recipe I promised to write down', 'traditions', 1990, array[
        'My granddaughter asked me for the recipe of my almond cake. I told her there is no recipe, you do it by eye.',
        'She made me cook it with her while she wrote everything in a notebook: a handful of this, a pinch of that, until it smells right.',
        'Now the notebook has my handwriting next to hers. I think that is better than any recipe.',
        'She says she will give it to her own daughter one day. I told her to add a page of her own first.',
        'Last week she sent me a photo: a new page, in her handwriting, with a cake that looked just like mine.'])
    ) as t(n, title, part, year, paragraphs)
    order by n
  loop
    insert into public.chapters (family_id, person_id, title, paragraphs, status, approved_at, part, year, created_at)
    values (senior.family_id, senior.id, story.title, story.paragraphs, 'approved', now(), story.part, story.year, now() + story.n * interval '1 second')
    returning id into new_id;
    perform public.place_story(new_id);
  end loop;

  -- Names for the chapters and books that hold these stories and have none yet, in order
  for r in
    select bc.id from public.book_chapters bc join public.books b on b.id = bc.book_id
    where bc.person_id = senior.id and bc.title is null
      and exists (select 1 from public.chapters s where s.book_chapter_id = bc.id and s.session_id is null and s.title = any(array[
        'The smell of my mother''s bread','The courtyard with the fig tree','Don Ernesto and the inkwell','The winter the river froze','The fiestas of Moors and Christians','Saturday dances in the square','The boy with the bicycle','Our wedding in Santa María','Two rooms and a balcony','Learning to cook for two','The night Carmen was born','Three children and one bathtub','Sunday rice for twelve','The recipe I promised to write down']))
    order by b.number, bc.number
  loop
    i := i + 1;
    if i <= array_length(chapter_titles, 1) then update public.book_chapters set title = chapter_titles[i] where id = r.id; end if;
  end loop;
  i := 0;
  for r in select b.id from public.books b where b.person_id = senior.id and b.title is null order by b.number loop
    i := i + 1;
    if i <= array_length(book_titles, 1) then update public.books set title = book_titles[i] where id = r.id; end if;
  end loop;
end $$;

-- ── To remove the demo stories later (run on its own) ──
-- delete from public.chapters where session_id is null and title in ('The smell of my mother''s bread','The courtyard with the fig tree','Don Ernesto and the inkwell','The winter the river froze','The fiestas of Moors and Christians','Saturday dances in the square','The boy with the bicycle','Our wedding in Santa María','Two rooms and a balcony','Learning to cook for two','The night Carmen was born','Three children and one bathtub','Sunday rice for twelve','The recipe I promised to write down');
-- delete from public.book_chapters bc where not exists (select 1 from public.chapters s where s.book_chapter_id = bc.id);
-- delete from public.books b where not exists (select 1 from public.book_chapters bc where bc.book_id = b.id);

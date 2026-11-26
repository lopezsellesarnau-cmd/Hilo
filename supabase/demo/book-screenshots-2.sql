-- More demo stories for App Store screenshots (fiction), after book-screenshots.sql: 18 approved stories that
-- finish book 3 and fill books 4 and 5 and start book 6. Each is over 500 characters, so a chapter holds two.
-- Set target_email below before running. To remove them, run the block at the end of this file.

do $$
declare
  target_email text := 'YOUR_EMAIL';
  senior record;
  story record;
  new_id uuid;
  chapter_titles text[] := array['Christmas at our house', 'The grandchildren', 'The textile mill', 'Our little shop', 'Behind the counter', 'The first time I saw the sea', 'Going back', 'Far from home', 'These days'];
  book_titles text[] := array['Hands that worked', 'Journeys', 'These days'];
  i int := 0;
  r record;
begin
  select s.id, s.family_id into senior
  from auth.users u
  join public.people m on m.user_id = u.id and m.role = 'member'
  join public.people s on s.family_id = m.family_id and s.role = 'senior'
  where u.email = target_email
  limit 1;
  if senior.id is null then raise exception 'No senior in the family of %', target_email; end if;

  for story in
    select * from (values
      (1, 'Christmas Eve in the kitchen', 'traditions', 1972, array[
        'On Christmas Eve the kitchen was the centre of the world. My mother, my sister and I cooked from noon, and the men were sent out so they wouldn''t steal anything.',
        'We made pelotas, the big meatballs wrapped in cabbage, and the soup that cooked for hours. The windows were so steamed that the children wrote their names on them.',
        'At midnight we went to mass, half asleep and very full. Coming home in the cold, with the bells still ringing, was my favourite part.',
        'I still make the pelotas every year. My hands know the recipe better than I do.']),
      (2, 'The nativity scene in the hall', 'traditions', 1975, array[
        'Vicente built a nativity scene in the hall every December. It grew every year: first a stable, then a river made of silver paper, then a whole village with lights.',
        'The children were allowed to move one figure each morning. The three kings walked a little closer every day, and on the sixth of January they finally arrived.',
        'One year the cat slept in the stable for a week, and we let him. The children said he was the ox.',
        'When Vicente died, my son put it up for me. He made the river exactly like his father did.']),
      (3, 'Becoming a grandmother', 'children', 1991, array[
        'When Carmen told me she was expecting, I sat down in the middle of the kitchen and cried. She thought something was wrong. It was only happiness.',
        'Little Lucía was born in May. I held her and felt the same as with my own children, but calmer, because this time I knew everything would pass.',
        'I looked after her three mornings a week. We walked to the park, fed the pigeons and sang the song my mother used to sing while she made bread.',
        'Now Lucía is a mother herself, and when she sings to her baby, it is that same song.']),
      (4, 'Summers full of grandchildren', 'children', 1998, array[
        'In summer the house filled with grandchildren. Six of them, all with sand in their shoes and wet towels on every chair.',
        'I made them breakfast in turns and lunch for an army. In the afternoons, while they slept, I sat on the balcony with Vicente and we didn''t say a word. We didn''t need to.',
        'At night they wanted stories, and I told them about the river that froze and the fig tree. They always asked for the one about the inkwell.',
        'The house was never so loud, and I was never so happy to be tired.',
        'In September the house was too quiet for a week.']),
      (5, 'My first day at the mill', 'work', 1954, array[
        'At fourteen I started at the textile mill, like almost every girl in Alcoy. The noise of the looms was so loud that the first day I thought I would go deaf.',
        'An older woman, Remedios, showed me how to tie the broken threads without stopping the machine. She had fingers as fast as birds.',
        'We worked from seven to seven, with half an hour for lunch. We ate bread and an omelette sitting on the bales of wool, and we laughed a lot.',
        'My first wage went straight to my mother. She gave me back one coin, and I bought my first lipstick.']),
      (6, 'Remedios and the looms', 'work', 1956, array[
        'Remedios became like an aunt to me. She knew every machine by its sound, and she could tell when one was going to break before it did.',
        'She taught me to read the cloth with my fingers: if it was too tight, too loose, if a thread was missing. To this day I touch every tablecloth I see.',
        'When she retired, all the girls stopped the looms at the same time for one minute. The silence was so strange that nobody spoke.',
        'I visited her every Sunday until she died. She always asked me if the machines still sounded right.']),
      (7, 'The strike of sixty-two', 'work', 1962, array[
        'In sixty-two there was a strike at the mill. We wanted better wages and a proper place to eat. I was very young and very frightened.',
        'For two weeks we didn''t work. The women organised a kitchen in the square so no family would go hungry. My mother cooked for forty people.',
        'In the end we got a little more money and a room with tables. It wasn''t much, but we had done it together.',
        'Vicente came to meet me every evening, so I wouldn''t walk home alone. That is when I knew I would marry him.',
        'He never said a word about it. He just walked beside me.']),
      (8, 'Opening our little shop', 'work', 1974, array[
        'In seventy-four Vicente and I opened a small haberdashery on Calle San Nicolás. Buttons, threads, ribbons, and wool in every colour.',
        'We painted it ourselves, green and white. The first morning nobody came until eleven, and then it was my mother, to buy a button she didn''t need.',
        'Little by little the neighbours came. They came for a zip and stayed half an hour talking. The shop was more a meeting point than a business.',
        'I still have the first receipt book, with my handwriting and a coffee stain on the cover.']),
      (9, 'The customers I remember', 'work', 1980, array[
        'Doña Pilar came every Thursday for black thread and never bought anything else. After ten years I asked her why. She said she liked talking to me.',
        'There was a young man who bought ribbon every week for his girlfriend''s hair. One day he bought white ribbon, and I knew there would be a wedding.',
        'And the children came with coins to buy a single button for their collections. I always gave them two.',
        'Some of those children still say hello to me in the street. They are grandparents now.',
        'A shop is a small window onto a whole town. I saw everything from behind that counter.']),
      (10, 'Closing the shop', 'work', 1999, array[
        'When Vicente''s back got bad, we decided to close the shop. It was the right thing, but I cried for a week.',
        'On the last day the neighbours came with flowers and cakes. Doña Pilar''s daughter came to buy one last spool of black thread for her mother.',
        'We gave away the buttons that were left to the children of the street. For years I saw them on coats all over town.',
        'Sometimes I walk past. It is a phone shop now, but I still see our green door.',
        'And I still check every button on my coat before I go out, out of habit.']),
      (11, 'The first time I saw the sea', 'travels', 1962, array[
        'I saw the sea for the first time on our honeymoon, in Benidorm, when it was still a village of fishermen. I was twenty-two.',
        'I stood on the sand for a long time without moving. It was much bigger and much louder than I had imagined from the map of Mallorca.',
        'Vicente rented a little boat and rowed us out. I held on to the sides the whole time and he laughed until he almost dropped the oars.',
        'Every summer after that, we went back to the same beach. It grew into a city, but the sea stayed the same.',
        'Vicente never learned to swim. He said the sea was for looking at.']),
      (12, 'A week in Paris', 'travels', 1987, array[
        'For our twenty-fifth anniversary the children gave us a trip to Paris. We had never been on a plane. I prayed the whole flight.',
        'Vicente wanted to see the tower and I wanted to see the shops on the big avenues. We did both, and our feet hurt for a week.',
        'We ate in a tiny restaurant where nobody spoke Spanish. Vicente ordered by pointing, and we got snails. He ate them all, very bravely.',
        'I still have the little tower he bought me. It sits next to the photo of our wedding.',
        'Every time I dust it, I remember the snails, and I laugh.']),
      (13, 'The train to Madrid', 'travels', 1993, array[
        'When Pepe went to study in Madrid, we took the night train to visit him. Vicente brought a whole omelette wrapped in newspaper.',
        'We shared the compartment with a family from Valencia, and by midnight we were all eating together and singing.',
        'Pepe met us at the station looking thin and tired. I filled his fridge for a month and cried on the way home.',
        'Now he says those were the best years of his life. I believe him, but I still think he didn''t eat enough.',
        'Now his own son is studying far away, and Pepe fills his fridge. Some things don''t change.']),
      (14, 'Back to my mothers village', 'travels', 2001, array[
        'My mother was born in a small village in the mountains, near Bocairent. One spring, my daughter drove me there for the first time in forty years.',
        'The house was still standing, with the same blue door. An old woman came out and asked who I was. When I said my mother''s name, she hugged me.',
        'She had played with my mother as a child. She showed us the fountain where they washed clothes and the tree where they carved their names.',
        'The names were still there. I touched them, and for a moment my mother was very close.']),
      (15, 'The Canary Islands with my sister', 'travels', 2006, array[
        'After Vicente died, my sister Amparo said we needed sun. She booked a week in Tenerife, and I didn''t dare say no.',
        'We walked on black sand and drank coffee looking at the sea. We talked about our parents, about the house on Calle Mayor, about everything.',
        'One evening we danced in the hotel, two old ladies with all the young people. A waiter said we danced better than anyone.',
        'It was the first time after Vicente that I laughed without feeling guilty.',
        'Amparo still says it was the best week of our lives as sisters. I think so too.']),
      (16, 'Letters from my granddaughter abroad', 'travels', 2015, array[
        'When Lucía went to study in Holland, she promised to write me real letters, not only messages on the phone. She kept her promise.',
        'Every month an envelope arrived with her neat handwriting and photos of canals, bicycles and grey skies. She complained about the rain in every letter.',
        'I wrote back about the fig tree, the fiestas and what I had cooked. She said my letters smelled of home.',
        'I keep them all in the box with my veil. One day they will be hers.',
        'She lives there now, and her letters still come every month.']),
      (17, 'My mornings now', 'today', 2026, array[
        'Now my mornings are slow, and I like them that way. I open the balcony, water the fig tree and listen to the street wake up.',
        'I have coffee with milk and toast with olive oil, the way my father had it. Then I call my sister, and we talk about nothing for half an hour.',
        'Some days the grandchildren call, and some days I go to the market and talk to everyone. I know the name of every stallholder.',
        'People think old age is empty. Mine is full of small things, and I don''t want to miss any of them.',
        'In the afternoon, I sit and tell Hilo a story, like this one.']),
      (18, 'What I would tell my grandchildren', 'today', 2026, array[
        'If my grandchildren ask me what I have learned, I will tell them this: eat together as often as you can. Most good things happen around a table.',
        'Don''t be afraid of hard work, but don''t let it eat your life. Remedios taught me that, and she was right.',
        'Dance when there is music, even if your knees complain. And keep the letters, the recipes and the photos. One day they will be all you have left of someone.',
        'And call your grandmother. She is always waiting by the phone, even if she pretends she isn''t.',
        'That is all. The rest, you will learn yourselves.'])
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
      and exists (select 1 from public.chapters s where s.book_chapter_id = bc.id and s.session_id is null and s.title = any(array['Christmas Eve in the kitchen','The nativity scene in the hall','Becoming a grandmother','Summers full of grandchildren','My first day at the mill','Remedios and the looms','The strike of sixty-two','Opening our little shop','The customers I remember','Closing the shop','The first time I saw the sea','A week in Paris','The train to Madrid','Back to my mothers village','The Canary Islands with my sister','Letters from my granddaughter abroad','My mornings now','What I would tell my grandchildren']))
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

-- ── To remove these demo stories later (run on its own) ──
-- delete from public.chapters where session_id is null and title in ('Christmas Eve in the kitchen','The nativity scene in the hall','Becoming a grandmother','Summers full of grandchildren','My first day at the mill','Remedios and the looms','The strike of sixty-two','Opening our little shop','The customers I remember','Closing the shop','The first time I saw the sea','A week in Paris','The train to Madrid','Back to my mothers village','The Canary Islands with my sister','Letters from my granddaughter abroad','My mornings now','What I would tell my grandchildren');
-- delete from public.book_chapters bc where not exists (select 1 from public.chapters s where s.book_chapter_id = bc.id);
-- delete from public.books b where not exists (select 1 from public.book_chapters bc where bc.book_id = b.id);
